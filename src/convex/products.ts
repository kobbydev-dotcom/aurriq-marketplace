import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

const VALID_CATEGORIES = ["hair", "cosmetics", "skincare", "nails", "fragrance", "tools"] as const;

export const createProduct = mutation({
  args: {
    name: v.string(),
    brand: v.string(),
    description: v.string(),
    category: v.string(),
    originalPrice: v.number(),
    promoPrice: v.optional(v.number()),
    stockQuantity: v.number(),
    lowStockThreshold: v.number(),
    images: v.array(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    if (!VALID_CATEGORIES.includes(args.category as (typeof VALID_CATEGORIES)[number])) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Invalid category" });
    }

    return await ctx.db.insert("products", {
      sellerId: user._id,
      name: args.name,
      brand: args.brand,
      description: args.description,
      category: args.category,
      originalPrice: args.originalPrice,
      promoPrice: args.promoPrice,
      stockQuantity: args.stockQuantity,
      lowStockThreshold: args.lowStockThreshold,
      images: args.images,
      tags: args.tags,
      isActive: true,
      totalSold: 0,
      totalRevenue: 0,
      lowStockAlertSent: false,
      outOfStockAlertSent: false,
    });
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
    stockQuantity: v.optional(v.number()),
    lowStockThreshold: v.optional(v.number()),
    images: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const product = await ctx.db.get(args.productId);
    if (!product) throw new ConvexError({ code: "NOT_FOUND", message: "Product not found" });
    if (product.sellerId !== user._id) throw new ConvexError({ code: "FORBIDDEN", message: "Not your product" });

    const { productId, ...updates } = args;
    // Reset alert flags if stock is being restocked above threshold
    const newStock = updates.stockQuantity ?? product.stockQuantity;
    const newThreshold = updates.lowStockThreshold ?? product.lowStockThreshold;
    const resetLowStockAlert = newStock > newThreshold ? { lowStockAlertSent: false } : {};
    const resetOutOfStockAlert = newStock > 0 ? { outOfStockAlertSent: false } : {};

    await ctx.db.patch(productId, { ...updates, ...resetLowStockAlert, ...resetOutOfStockAlert });
  },
});

export const deleteProduct = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const product = await ctx.db.get(args.productId);
    if (!product) throw new ConvexError({ code: "NOT_FOUND", message: "Product not found" });
    if (product.sellerId !== user._id) throw new ConvexError({ code: "FORBIDDEN", message: "Not your product" });

    await ctx.db.delete(args.productId);
  },
});

export const getMyProducts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    return await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("sellerId", user._id))
      .order("desc")
      .collect();
  },
});

export const getProductById = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return null;
    const seller = await ctx.db.get(product.sellerId);
    return { ...product, seller };
  },
});

export const listProducts = query({
  args: {
    category: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let productsQuery;

    if (args.category) {
      productsQuery = ctx.db
        .query("products")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .filter((q) => q.eq(q.field("isActive"), true));
    } else {
      productsQuery = ctx.db
        .query("products")
        .withIndex("by_active", (q) => q.eq("isActive", true));
    }

    const products = await productsQuery.order("desc").take(100);

    // Enrich with seller info
    const enriched = await Promise.all(
      products.map(async (p) => {
        const seller = await ctx.db.get(p.sellerId);
        return {
          ...p,
          sellerName: seller?.name ?? "Unknown Seller",
          sellerIsVerified: seller?.isVerified ?? false,
        };
      })
    );

    if (args.search) {
      const q = args.search.toLowerCase();
      return enriched.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    return enriched;
  },
});

export const getSellerStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;

    const products = await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("sellerId", user._id))
      .collect();

    const totalProducts = products.length;
    const activeProducts = products.filter((p) => p.isActive).length;
    const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0);
    const totalSold = products.reduce((sum, p) => sum + p.totalSold, 0);
    const lowStockProducts = products.filter(
      (p) => p.stockQuantity <= p.lowStockThreshold && p.stockQuantity > 0
    );
    const outOfStockProducts = products.filter((p) => p.stockQuantity === 0);

    return {
      totalProducts,
      activeProducts,
      totalRevenue,
      totalSold,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
    };
  },
});
