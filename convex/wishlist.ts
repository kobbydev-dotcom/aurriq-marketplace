import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

// Toggle a product in/out of the current user's wishlist. Returns the new state.
export const toggleWishlist = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("wishlist")
      .withIndex("by_user_and_product", (q) => q.eq("userId", me._id).eq("productId", args.productId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { wishlisted: false };
    }
    await ctx.db.insert("wishlist", { userId: me._id, productId: args.productId });
    return { wishlisted: true };
  },
});

export const isWishlisted = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return false;
    const existing = await ctx.db
      .query("wishlist")
      .withIndex("by_user_and_product", (q) => q.eq("userId", me._id).eq("productId", args.productId))
      .unique();
    return !!existing;
  },
});

// The current user's wishlist with product details resolved.
export const getMyWishlist = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const items = await ctx.db
      .query("wishlist")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .order("desc")
      .collect();
    const products = await Promise.all(items.map((i) => ctx.db.get(i.productId)));
    return products.filter((p) => p !== null);
  },
});
