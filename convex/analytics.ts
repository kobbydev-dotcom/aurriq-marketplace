import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

// Record an analytics event (view, etc.). Public so any visitor can be tracked.
export const trackEvent = mutation({
  args: {
    subjectType: v.string(), // "product" | "seller"
    subjectId: v.string(),
    kind: v.string(), // "product_view" | "shop_view" | "purchase"
    productId: v.optional(v.id("products")),
    sellerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    await ctx.db.insert("analyticsEvents", {
      subjectType: args.subjectType,
      subjectId: args.subjectId,
      kind: args.kind,
      actorId: me?._id,
      productId: args.productId,
      sellerId: args.sellerId,
    });
    return true;
  },
});

// Internal variant for server-side recording (e.g. purchases during settlement).
export const recordEvent = internalMutation({
  args: {
    subjectType: v.string(),
    subjectId: v.string(),
    kind: v.string(),
    actorId: v.optional(v.id("users")),
    productId: v.optional(v.id("products")),
    sellerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("analyticsEvents", {
      subjectType: args.subjectType,
      subjectId: args.subjectId,
      kind: args.kind,
      actorId: args.actorId,
      productId: args.productId,
      sellerId: args.sellerId,
    });
  },
});

// Public per-product view count (for social proof on product pages).
export const getProductViewCount = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();
    return events.filter((e) => e.kind === "product_view").length;
  },
});

// Aggregated analytics for the current seller's dashboard.
export const getSellerAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return null;

    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("by_seller", (q) => q.eq("sellerId", me._id))
      .collect();

    const productViews = events.filter((e) => e.kind === "product_view");
    const shopViews = events.filter((e) => e.kind === "shop_view");

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_seller", (q) => q.eq("sellerId", me._id))
      .collect();
    const completed = orders.filter((o) => o.status !== "cancelled" && o.status !== "awaiting_payment");
    const totalRevenue = completed.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
    const totalUnits = completed.reduce((s, o) => s + (o.quantity ?? 1), 0);

    const followers = await ctx.db
      .query("follows")
      .withIndex("by_followee", (q) => q.eq("followeeId", me._id))
      .collect();

    // Per-product view counts
    const byProduct = new Map<string, number>();
    for (const e of productViews) {
      if (!e.productId) continue;
      byProduct.set(String(e.productId), (byProduct.get(String(e.productId)) ?? 0) + 1);
    }

    // Views over the last 14 days
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const viewsSeries: { day: string; views: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const dayStart = now - i * dayMs;
      const dayEnd = dayStart + dayMs;
      const label = new Date(dayStart).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const views = productViews.filter((e) => e._creationTime >= dayStart && e._creationTime < dayEnd).length;
      viewsSeries.push({ day: label, views });
    }

    const views = productViews.length;
    const conversionRate = views > 0 ? (completed.length / views) * 100 : 0;

    return {
      productViews: views,
      shopViews: shopViews.length,
      totalViews: views + shopViews.length,
      ordersCount: completed.length,
      totalRevenue,
      totalUnits,
      followers: followers.length,
      conversionRate: Math.round(conversionRate * 10) / 10,
      avgOrderValue: completed.length > 0 ? Math.round((totalRevenue / completed.length) * 100) / 100 : 0,
      viewsSeries,
    };
  },
});

// Top products by views for the current seller.
export const getTopProducts = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];

    const products = await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("sellerId", me._id))
      .collect();

    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("by_seller", (q) => q.eq("sellerId", me._id))
      .collect();
    const viewCount = new Map<string, number>();
    for (const e of events) {
      if (e.kind === "product_view" && e.productId) {
        viewCount.set(String(e.productId), (viewCount.get(String(e.productId)) ?? 0) + 1);
      }
    }

    return products
      .map((p: any) => ({
        _id: p._id,
        name: p.name,
        image: p.images?.[0],
        price: p.promoPrice ?? p.originalPrice,
        totalSold: p.totalSold ?? 0,
        totalRevenue: p.totalRevenue ?? 0,
        views: viewCount.get(String(p._id)) ?? 0,
      }))
      .sort((a: any, b: any) => b.views - a.views || b.totalRevenue - a.totalRevenue)
      .slice(0, 8);
  },
});
