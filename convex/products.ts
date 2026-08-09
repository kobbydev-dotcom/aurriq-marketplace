import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getCurrentSeller(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

async function enrichProduct(ctx: any, product: any) {
  const seller = await ctx.db.get(product.sellerId);
  return {
    ...product,
    seller: seller ? {
      _id: seller._id,
      name: seller.name,
      image: seller.image ?? seller.avatar,
      isVerified: seller.isVerified,
    } : null,
    sellerName: seller?.name ?? "Aurriq Seller",
    sellerIsVerified: !!seller?.isVerified,
  };
}

// 1. Your original query to display products on the marketplace
export const listAll = query({
  args: {
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    sellerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db.query("products").collect();
    const normalizedSearch = args.search?.trim().toLowerCase();

    const filtered = products.filter((product) => {
      if (!product.isActive) return false;
      if (args.category && product.category !== args.category) return false;
      if (args.sellerId && product.sellerId !== args.sellerId) return false;

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

    return await Promise.all(filtered.map((product) => enrichProduct(ctx, product)));
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
    tags: v.array(v.string()),
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
      tags: args.tags,
      variants: args.variants,

      // Hardcoded tracking parameters required by schema initialization:
      sellerId: user._id,
      totalSold: 0,
      totalRevenue: 0,
      isActive: true,
    });

    return productId;
  },
});

export const getMyProducts = query({
  args: {},
  handler: async (ctx) => {
    const seller = await getCurrentSeller(ctx);
    if (!seller) return [];

    return await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
      .order("desc")
      .collect();
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
    tags: v.optional(v.array(v.string())),
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
      imageUrl: nextImages[0] ?? product.imageUrl ?? "",
      tags: args.tags ?? product.tags,
      variants: nextVariants,
      isActive: typeof args.isActive === "boolean" ? args.isActive : product.isActive,
      lowStockAlertSent: nextStock > nextThreshold ? false : product.lowStockAlertSent,
      outOfStockAlertSent: nextStock > 0 ? false : product.outOfStockAlertSent,
    };

    await ctx.db.patch(args.productId, patch as any);
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