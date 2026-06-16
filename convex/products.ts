import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// 1. Your original query to display products on the marketplace
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("products").collect();
  },
});

// 2. Your original query to view a single product's detail page
export const getById = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.productId);
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
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
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
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    if (!user) throw new Error("User profile not found.");

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