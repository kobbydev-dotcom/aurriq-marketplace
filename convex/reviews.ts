import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

async function updateProductRating(ctx: MutationCtx, productId: any) {
  const reviews = await ctx.db
    .query("reviews")
    .withIndex("by_product", (q) => q.eq("productId", productId))
    .collect();
  const visible = reviews.filter((review) => !review.deletedAt);
  const count = visible.length;
  const avg = count ? visible.reduce((sum, review) => sum + review.rating, 0) / count : 0;
  await ctx.db.patch(productId, { ratingAvg: Math.round(avg * 10) / 10, ratingCount: count });
}

// Add/update a buyer review. Updating a previously hidden review makes it visible again.
export const addReview = mutation({
  args: { productId: v.id("products"), rating: v.number(), comment: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    const rating = Math.min(5, Math.max(1, Math.round(args.rating)));
    const existing = await ctx.db.query("reviews")
      .withIndex("by_user_and_product", (q) => q.eq("userId", me._id).eq("productId", args.productId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { rating, comment: args.comment, deletedAt: undefined, deletedBySellerId: undefined });
    } else {
      await ctx.db.insert("reviews", { productId: args.productId, userId: me._id, rating, comment: args.comment });
    }
    await updateProductRating(ctx, args.productId);
    return true;
  },
});

export const deleteReviewBySeller = mutation({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, args) => {
    const seller = await getCurrentUser(ctx);
    if (!seller || seller.role !== "seller") throw new ConvexError({ code: "FORBIDDEN", message: "Seller account required" });
    const review = await ctx.db.get(args.reviewId);
    if (!review || review.deletedAt) throw new ConvexError({ code: "NOT_FOUND", message: "Review not found" });
    const product = await ctx.db.get(review.productId);
    if (!product || product.sellerId !== seller._id) throw new ConvexError({ code: "FORBIDDEN", message: "You can only remove reviews on your own products" });
    await ctx.db.patch(review._id, {
      deletedAt: Date.now(),
      deletedBySellerId: seller._id,
      productNameSnapshot: product.name,
      sellerNameSnapshot: seller.name ?? "Unknown seller",
    });
    await updateProductRating(ctx, product._id);
    return true;
  },
});

export const getProductReviews = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    const product = await ctx.db.get(args.productId);
    const reviews = await ctx.db.query("reviews")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .order("desc").collect();
    return await Promise.all(reviews.filter((review) => !review.deletedAt).map(async (review) => {
      const user: any = await ctx.db.get(review.userId);
      return { ...review, userName: user?.name ?? "Customer", userImage: user?.image ?? user?.avatar, canDelete: !!(me && product && me.role === "seller" && product.sellerId === me._id) };
    }));
  },
});

export const getMyReview = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return null;
    return await ctx.db.query("reviews")
      .withIndex("by_user_and_product", (q) => q.eq("userId", me._id).eq("productId", args.productId))
      .unique();
  },
});

// Review history is private to Aurriq platform administrators.
export const listDeletedReviewsAdmin = query({
  args: {},
  handler: async (ctx) => {
    const admin = await getCurrentUser(ctx);
    if (!admin || admin.role !== "admin") return [];
    const deleted = await ctx.db.query("reviews")
      .withIndex("by_deleted_at", (q) => q.gt("deletedAt", 0))
      .order("desc")
      .take(300);
    return await Promise.all(deleted.map(async (review) => {
      const [product, reviewer, seller] = await Promise.all([
        ctx.db.get(review.productId), ctx.db.get(review.userId),
        review.deletedBySellerId ? ctx.db.get(review.deletedBySellerId) : null,
      ]);
      return {
        ...review,
        productName: product?.name ?? review.productNameSnapshot ?? "Deleted product",
        sellerName: seller?.name ?? review.sellerNameSnapshot ?? "Deleted seller",
        reviewerName: reviewer?.name ?? "Deleted customer",
      };
    }));
  },
});
