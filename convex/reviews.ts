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

// Add or update the current user's review for a product (one per user/product).
export const addReview = mutation({
  args: {
    productId: v.id("products"),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const rating = Math.min(5, Math.max(1, Math.round(args.rating)));

    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_user_and_product", (q) => q.eq("userId", me._id).eq("productId", args.productId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { rating, comment: args.comment });
    } else {
      await ctx.db.insert("reviews", {
        productId: args.productId,
        userId: me._id,
        rating,
        comment: args.comment,
      });
    }

    // Recompute the product's denormalized rating.
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();
    const count = reviews.length;
    const avg = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
    await ctx.db.patch(args.productId, {
      ratingAvg: Math.round(avg * 10) / 10,
      ratingCount: count,
    });
    return true;
  },
});

export const getProductReviews = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .order("desc")
      .collect();
    return await Promise.all(
      reviews.map(async (r) => {
        const user: any = await ctx.db.get(r.userId);
        return { ...r, userName: user?.name ?? "Customer", userImage: user?.image ?? user?.avatar };
      })
    );
  },
});

export const getMyReview = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return null;
    return await ctx.db
      .query("reviews")
      .withIndex("by_user_and_product", (q) => q.eq("userId", me._id).eq("productId", args.productId))
      .unique();
  },
});
