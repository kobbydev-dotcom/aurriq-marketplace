import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

async function getCurrentSeller(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

// Haversine distance in kilometers between two coordinates.
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Resolve a media value to a displayable URL. New uploads are stored as Convex
// storage IDs (which we resolve to a fresh signed URL); legacy external URLs
// (e.g. seeded CDN links) are passed through unchanged.
async function resolveMediaUrl(ctx: any, value: string | undefined | null): Promise<string> {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  try {
    const url = await ctx.storage.getUrl(value as any);
    return url ?? value;
  } catch {
    return value;
  }
}

async function enrichProduct(ctx: any, product: any) {
  const seller = await ctx.db.get(product.sellerId);
  const images = await Promise.all((product.images ?? []).map((m: string) => resolveMediaUrl(ctx, m)));
  const videos = await Promise.all((product.videos ?? []).map((m: string) => resolveMediaUrl(ctx, m)));
  const imageUrl = product.imageUrl ? await resolveMediaUrl(ctx, product.imageUrl) : (images[0] ?? "");
  return {
    ...product,
    images,
    videos,
    imageUrl,
    seller: seller ? {
      _id: seller._id,
      name: seller.name,
      image: seller.image ?? seller.avatar,
      isVerified: seller.isVerified,
      businessType: seller.businessType,
      phone: seller.phone,
    } : null,
    sellerName: seller?.name ?? "Aurriq Seller",
    sellerIsVerified: !!seller?.isVerified,
    sellerBusinessType: seller?.businessType,
    sellerPhone: seller?.phone,
  };
}

// Generate a short-lived upload URL the client can POST a file to. Returns the
// URL; after POSTing, the response body contains the storageId to save.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized: You must be logged in to upload media.");
    return await ctx.storage.generateUploadUrl();
  },
});

// 1. Your original query to display products on the marketplace
export const listAll = query({
  args: {
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    sellerId: v.optional(v.id("users")),
    nearLat: v.optional(v.number()),
    nearLng: v.optional(v.number()),
    maxDistanceKm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db.query("products").collect();
    const normalizedSearch = args.search?.trim().toLowerCase();
    const filterByDistance =
      typeof args.nearLat === "number" && typeof args.nearLng === "number" && typeof args.maxDistanceKm === "number";

    const filtered = products.filter((product) => {
      if (!product.isActive) return false;
      if (args.category && product.category !== args.category) return false;
      if (args.sellerId && product.sellerId !== args.sellerId) return false;

      // Distance filter: only products from sellers within the radius.
      if (filterByDistance) {
        const p: any = product;
        if (!(p.sellerLocationShared && typeof p.sellerLatitude === "number" && typeof p.sellerLongitude === "number")) {
          return false;
        }
        const d = distanceKm(args.nearLat!, args.nearLng!, p.sellerLatitude, p.sellerLongitude);
        if (d > args.maxDistanceKm!) return false;
      }

      if (!normalizedSearch) return true;

      const haystack = [
        product.name,
        product.title,
        product.brand,
        product.description,
        product.category,
        ...(product.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    let enriched = await Promise.all(filtered.map((product) => enrichProduct(ctx, product)));

    // Attach distance for display when filtering by proximity.
    if (filterByDistance) {
      enriched = enriched
        .map((p: any) => ({
          ...p,
          distanceKm:
            typeof p.sellerLatitude === "number" && typeof p.sellerLongitude === "number"
              ? distanceKm(args.nearLat!, args.nearLng!, p.sellerLatitude, p.sellerLongitude)
              : undefined,
        }))
        .sort((a: any, b: any) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }

    return enriched;
  },
});

// 2. Your original query to view a single product's detail page
export const getById = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return null;
    return await enrichProduct(ctx, product);
  },
});

// 3. Your original mutation to handle adding things to the cart
export const addToCart = mutation({
  args: { productId: v.id("products"), quantity: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
      
    if (!user) throw new Error("User profile not synced");

    const existing = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("productId"), args.productId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        quantity: existing.quantity + args.quantity,
      });
    } else {
      await ctx.db.insert("cartItems", {
        userId: user._id,
        productId: args.productId,
        quantity: args.quantity,
      });
    }
  },
});

// 4. NEW: Allows real users to upload/list their own products
export const createProduct = mutation({
  args: {
    name: v.string(),
    brand: v.string(),
    description: v.string(),
    category: v.string(),
    originalPrice: v.number(),
    promoPrice: v.optional(v.number()),
    variants: v.optional(v.any()),
    lowStockThreshold: v.number(),
    images: v.array(v.string()),
    videos: v.optional(v.array(v.string())),
    tags: v.array(v.string()),
    paymentOptions: v.optional(v.object({ mode: v.string(), percent: v.optional(v.number()) })),
    wholesalePrice: v.optional(v.number()),
    wholesaleMinQty: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized: You must be logged in to sell items.");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) throw new Error("User profile not found.");
    if (!(user.isSeller || user.role === "seller")) {
      throw new Error("Activate your seller account before listing products.");
    }

    // Extract the main photo from the array if one exists
    const mainImageUrl = args.images.length > 0 ? args.images[0] : "";

    const productId = await ctx.db.insert("products", {
      // Direct string mapping values from your advanced form schema:
      name: args.name,
      title: args.name, // Fills title automatically to keep schema fallbacks satisfied
      brand: args.brand,
      description: args.description,
      category: args.category,
      
      // Pricing data models
      originalPrice: args.originalPrice,
      price: args.promoPrice && args.promoPrice > 0 ? args.promoPrice : args.originalPrice,
      promoPrice: args.promoPrice,

      // Stock control management pipelines
      stockQuantity: args.variants?.[0]?.stock ?? 0, // Pulls number directly out of form variants block
      lowStockThreshold: args.lowStockThreshold,
      
      // Image galleries mapping configuration
      imageUrl: mainImageUrl, 
      images: args.images,
      videos: args.videos ?? [],
      tags: args.tags,
      variants: args.variants,
      paymentOptions: args.paymentOptions ?? { mode: "momo" },

      // Denormalized seller location for distance filtering.
      sellerLatitude: (user as any).latitude,
      sellerLongitude: (user as any).longitude,
      sellerLocationLabel: (user as any).locationLabel,
      sellerLocationShared: (user as any).locationShared ?? false,
      wholesalePrice: args.wholesalePrice,
      wholesaleMinQty: args.wholesaleMinQty,

      // Hardcoded tracking parameters required by schema initialization:
      sellerId: user._id,
      totalSold: 0,
      totalRevenue: 0,
      isActive: true,
    });

    // Notify followers + log activity.
    await ctx.scheduler.runAfter(0, internal.products.onProductCreated, {
      productId,
      sellerId: user._id,
    });

    return productId;
  },
});

// Internal: after a product is created, notify the seller's followers + log activity.
export const onProductCreated = internalMutation({
  args: { productId: v.id("products"), sellerId: v.id("users") },
  handler: async (ctx, args) => {
    const product: any = await ctx.db.get(args.productId);
    const seller: any = await ctx.db.get(args.sellerId);
    if (!product || !seller) return;

    await ctx.runMutation(internal.notifications.logActivity, {
      userId: args.sellerId,
      action: `Listed "${product.name}" for sale`,
      meta: { productId: args.productId },
    });

    const followers = await ctx.db
      .query("follows")
      .withIndex("by_followee", (q) => q.eq("followeeId", args.sellerId))
      .collect();

    for (const f of followers) {
      await ctx.runMutation(internal.notifications.createNotification, {
        userId: f.followerId,
        type: "new_product",
        title: `${seller.name ?? "A seller you follow"} posted a new product`,
        body: product.name,
        link: `/product/${args.productId}`,
      });
    }
  },
});

export const getMyProducts = query({
  args: {},
  handler: async (ctx) => {
    const seller = await getCurrentSeller(ctx);
    if (!seller) return [];

    const products = await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
      .order("desc")
      .collect();

    return await Promise.all(products.map((product) => enrichProduct(ctx, product)));
  },
});

export const getSellerStats = query({
  args: {},
  handler: async (ctx) => {
    const seller = await getCurrentSeller(ctx);
    if (!seller) {
      return {
        totalProducts: 0,
        activeProducts: 0,
        totalSold: 0,
        totalRevenue: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      };
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
      .collect();

    const lowStockCount = products.filter((product) => product.stockQuantity > 0 && product.stockQuantity <= product.lowStockThreshold).length;
    const outOfStockCount = products.filter((product) => product.stockQuantity === 0).length;

    return {
      totalProducts: products.length,
      activeProducts: products.filter((product) => product.isActive).length,
      totalSold: products.reduce((sum, product) => sum + (product.totalSold ?? 0), 0),
      totalRevenue: products.reduce((sum, product) => sum + (product.totalRevenue ?? 0), 0),
      lowStockCount,
      outOfStockCount,
    };
  },
});

export const updateProduct = mutation({
  args: {
    productId: v.id("products"),
    name: v.optional(v.string()),
    brand: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    originalPrice: v.optional(v.number()),
    promoPrice: v.optional(v.number()),
    variants: v.optional(v.any()),
    lowStockThreshold: v.optional(v.number()),
    images: v.optional(v.array(v.string())),
    videos: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    paymentOptions: v.optional(v.object({ mode: v.string(), percent: v.optional(v.number()) })),
    wholesalePrice: v.optional(v.number()),
    wholesaleMinQty: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new Error("User not found");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");
    if (product.sellerId !== user._id) throw new Error("Not your product");

    const nextImages = args.images ?? product.images ?? [];
    const nextVariants = args.variants ?? product.variants;
    const nextStock = typeof args.variants !== "undefined"
      ? Number(args.variants?.[0]?.stock ?? product.stockQuantity)
      : product.stockQuantity;
    const nextThreshold = args.lowStockThreshold ?? product.lowStockThreshold;

    const patch: Record<string, unknown> = {
      name: args.name ?? product.name,
      title: args.name ?? product.title ?? product.name,
      brand: args.brand ?? product.brand,
      description: args.description ?? product.description,
      category: args.category ?? product.category,
      originalPrice: args.originalPrice ?? product.originalPrice,
      price: (args.promoPrice && args.promoPrice > 0 ? args.promoPrice : (args.originalPrice ?? product.originalPrice)) ?? product.price,
      promoPrice: typeof args.promoPrice === "number" ? args.promoPrice : product.promoPrice,
      stockQuantity: nextStock,
      lowStockThreshold: nextThreshold,
      images: nextImages,
      videos: args.videos ?? product.videos ?? [],
      imageUrl: nextImages[0] ?? product.imageUrl ?? "",
      tags: args.tags ?? product.tags,
      variants: nextVariants,
      paymentOptions: (args as any).paymentOptions ?? (product as any).paymentOptions,
      // Refresh denormalized seller location in case the seller moved / toggled sharing.
      sellerLatitude: (user as any).latitude,
      sellerLongitude: (user as any).longitude,
      sellerLocationLabel: (user as any).locationLabel,
      sellerLocationShared: (user as any).locationShared ?? false,
      wholesalePrice: args.wholesalePrice !== undefined ? args.wholesalePrice : (product as any).wholesalePrice,
      wholesaleMinQty: args.wholesaleMinQty !== undefined ? args.wholesaleMinQty : (product as any).wholesaleMinQty,
      isActive: typeof args.isActive === "boolean" ? args.isActive : product.isActive,
      lowStockAlertSent: nextStock > nextThreshold ? false : product.lowStockAlertSent,
      outOfStockAlertSent: nextStock > 0 ? false : product.outOfStockAlertSent,
    };

    await ctx.db.patch(args.productId, patch as any);

    // If the product was restocked from zero, notify users who wishlisted it.
    const wasOut = (product.stockQuantity ?? 0) === 0;
    const nowIn = nextStock > 0;
    if (wasOut && nowIn) {
      await ctx.scheduler.runAfter(0, internal.inventory.setStock, {
        productId: args.productId,
        stockQuantity: nextStock,
      });
    }
    return args.productId;
  },
});

export const deleteProduct = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new Error("User not found");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");
    if (product.sellerId !== user._id) throw new Error("Not your product");

    await ctx.db.delete(args.productId);
    return true;
  },
});

// One-off: backfill denormalized seller location onto existing products.
export const backfillSellerLocation = mutation({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    let updated = 0;
    for (const product of products) {
      const seller: any = await ctx.db.get(product.sellerId);
      if (!seller) continue;
      await ctx.db.patch(product._id, {
        sellerLatitude: seller.latitude,
        sellerLongitude: seller.longitude,
        sellerLocationLabel: seller.locationLabel,
        sellerLocationShared: seller.locationShared ?? false,
      });
      updated++;
    }
    return { updated };
  },
});