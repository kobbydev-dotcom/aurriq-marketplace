import { internalAction, internalMutation, mutation, query } from "./_generated/server";
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

// ── AI insights for sellers ────────────────────────────────────────────────
// Deterministic, free insights derived from the seller's real data. If an
// OPENAI_API_KEY is configured, we additionally return an LLM-written summary.
export const getSellerInsights = query({
  args: {},
  handler: async (ctx): Promise<any> => {
    const me = await getCurrentUser(ctx);
    if (!me) return null;

    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("by_seller", (q) => q.eq("sellerId", me._id))
      .collect();
    const productViews = events.filter((e) => e.kind === "product_view");
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_seller", (q) => q.eq("sellerId", me._id))
      .collect();
    const completed = orders.filter((o) => o.status !== "cancelled" && o.status !== "awaiting_payment");
    const products = await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("sellerId", me._id))
      .collect();

    const insights: string[] = [];

    // Weekend vs weekday views
    let weekend = 0;
    let weekday = 0;
    for (const e of productViews) {
      const d = new Date(e._creationTime).getDay();
      if (d === 0 || d === 6) weekend++; else weekday++;
    }
    if (productViews.length >= 10 && weekend > weekday * 0.6) {
      insights.push("Most of your product views happen on weekends — consider launching promos Friday–Sunday for maximum reach.");
    }

    // Conversion
    const views = productViews.length;
    const conv = views > 0 ? (completed.length / views) * 100 : 0;
    if (views > 20 && conv < 3) {
      insights.push(`Your conversion is ${conv.toFixed(1)}% across ${views} views. Sharper photos or clearer pricing could turn more browsers into buyers.`);
    } else if (conv >= 8) {
      insights.push(`Strong ${conv.toFixed(1)}% conversion — your listings are resonating. Keep the momentum with fresh stock.`);
    }

    // Low stock with high views
    const viewByProduct = new Map<string, number>();
    for (const e of productViews) {
      if (e.productId) viewByProduct.set(String(e.productId), (viewByProduct.get(String(e.productId)) ?? 0) + 1);
    }
    for (const p of products as any[]) {
      const v = viewByProduct.get(String(p._id)) ?? 0;
      if (p.stockQuantity > 0 && p.stockQuantity <= (p.lowStockThreshold ?? 5) && v >= 5) {
        insights.push(`"${p.name}" is getting views (${v}) but is low on stock (${p.stockQuantity} left) — restock soon to avoid missed sales.`);
      }
      if (v === 0 && p.isActive) {
        insights.push(`"${p.name}" has had no views yet — try a clearer cover photo or add it to a promo.`);
      }
    }

    if (insights.length === 0) {
      insights.push("Keep listing quality products and sharing your shop — insights will appear as buyers browse and buy.");
    }

    return { insights: insights.slice(0, 5) };
  },
});

// Optional: LLM-written narrative summary of the seller's stats (uses OpenAI if configured).
export const getSellerAiSummary = internalAction({
  args: { sellerId: v.id("users") },
  handler: async (ctx, args): Promise<{ summary: string }> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { summary: "" };

    const stats: any = await ctx.runQuery(("analytics:getSellerAnalytics" as any), {});
    const prompt = `You are a business coach for a beauty marketplace seller. Given these stats, write 2-3 short, encouraging, actionable sentences:\n${JSON.stringify(stats)}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    const summary = json?.choices?.[0]?.message?.content?.trim() ?? "";
    return { summary };
  },
});

// ── Buyer-facing analytics ──────────────────────────────────────────────────
export const getBuyerAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return null;

    // Purchase history
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_buyer", (q) => q.eq("buyerId", me._id))
      .collect();
    const completed = orders.filter((o) => o.status !== "cancelled");
    const totalSpent = completed.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
    const itemsBought = completed.reduce((s, o) => s + (o.quantity ?? 1), 0);

    // Browsing history (product views by this user)
    const views = await ctx.db
      .query("analyticsEvents")
      .withIndex("by_actor", (q) => q.eq("actorId", me._id))
      .collect();
    const productViews = views.filter((e) => e.kind === "product_view").sort((a, b) => b._creationTime - a._creationTime);
    const seen = new Set<string>();
    const recentlyViewed: any[] = [];
    for (const e of productViews) {
      if (!e.productId || seen.has(String(e.productId))) continue;
      seen.add(String(e.productId));
      const product: any = await ctx.db.get(e.productId);
      if (product) recentlyViewed.push({ ...product, viewedAt: e._creationTime });
      if (recentlyViewed.length >= 12) break;
    }

    const wishlistCount = (await ctx.db.query("wishlist").withIndex("by_user", (q) => q.eq("userId", me._id)).collect()).length;
    const followingCount = (await ctx.db.query("follows").withIndex("by_follower", (q) => q.eq("followerId", me._id)).collect()).length;

    return {
      totalOrders: completed.length,
      totalSpent,
      itemsBought,
      productsViewed: seen.size,
      wishlistCount,
      followingCount,
      recentlyViewed,
    };
  },
});
