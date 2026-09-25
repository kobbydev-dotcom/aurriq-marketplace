import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

async function currentMarketplaceUser(ctx: any, identity: any) {
  const authSubject = String(identity.subject ?? "").split("|")[0];
  if (authSubject) {
    const stableUser = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q: any) => q.eq("authSubject", authSubject))
      .unique();
    if (stableUser) return stableUser;
  }

  return await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

// Create an in-app notification for a user.
export const createNotification = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.optional(v.string()),
    link: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      link: args.link,
      isRead: false,
    });

    if (args.type === "order_placed" || args.type === "low_stock") {
      const recipient: any = await ctx.db.get(args.userId);
      if (recipient?.doabookproLinkVerifiedAt && recipient.doabookproSlug && recipient.email) {
        await ctx.scheduler.runAfter(0, internal.notifications.forwardDoabookproNotification, {
          eventId: String(notificationId),
          sellerId: String(recipient._id),
          sellerEmail: recipient.email,
          businessSlug: recipient.doabookproSlug,
          eventType: args.type,
          title: args.title,
          message: args.body ?? args.title,
        });
      }
    }
  },
});

export const forwardDoabookproNotification = internalAction({
  args: {
    eventId: v.string(),
    sellerId: v.string(),
    sellerEmail: v.string(),
    businessSlug: v.string(),
    eventType: v.union(v.literal("order_placed"), v.literal("low_stock")),
    title: v.string(),
    message: v.string(),
  },
  handler: async (_ctx, args) => {
    const requestUrl = process.env.DOABOOKPRO_MARKETPLACE_REQUEST_URL;
    const secret = process.env.DOABOOKPRO_MARKETPLACE_SECRET;
    if (!requestUrl || !secret) return { skipped: true, reason: "not_configured" };

    let endpoint: URL;
    try {
      endpoint = new URL(requestUrl);
    } catch {
      return { skipped: true, reason: "invalid_configuration" };
    }
    if (
      endpoint.protocol !== "https:" ||
      endpoint.hostname !== "admin.doabookpro.com" ||
      !/\/api\/aurriq\/marketplace-activation-request\/?$/.test(endpoint.pathname)
    ) {
      return { skipped: true, reason: "invalid_configuration" };
    }
    endpoint.pathname = endpoint.pathname.replace(
      /\/api\/aurriq\/marketplace-activation-request\/?$/,
      "/api/aurriq/marketplace-notification",
    );
    endpoint.search = "";
    endpoint.hash = "";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + secret },
      body: JSON.stringify({
        eventId: args.eventId,
        sellerId: args.sellerId,
        sellerEmail: args.sellerEmail,
        businessSlug: args.businessSlug,
        eventType: args.eventType,
        title: args.title,
        message: args.message,
      }),
    });
    if (!response.ok) {
      throw new Error("DOABookPro marketplace notification returned HTTP " + response.status);
    }
    return { forwarded: true };
  },
});

// Record an audit-trail entry for an account (sale, edit, status change, etc.).
export const logActivity = internalMutation({
  args: {
    userId: v.id("users"),
    action: v.string(),
    meta: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activity", {
      userId: args.userId,
      action: args.action,
      meta: args.meta,
    });
  },
});

// Current user's notifications (most recent first).
export const getMyNotifications = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await currentMarketplaceUser(ctx, identity);
    if (!user) return [];
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
  },
});

// Count of unread notifications for the bell badge.
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const user = await currentMarketplaceUser(ctx, identity);
    if (!user) return 0;
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return all.filter((n) => !n.isRead).length;
  },
});

export const getNavBadgeCounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { cart: 0, orders: 0, messages: 0, wishlist: 0, seller: 0 };
    }
    const user = await currentMarketplaceUser(ctx, identity);
    if (!user) return { cart: 0, orders: 0, messages: 0, wishlist: 0, seller: 0 };

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const unread = notifications.filter((notification) => !notification.isRead);

    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const receivedMessages = await ctx.db
      .query("messages")
      .withIndex("by_receiver", (q) => q.eq("receiverId", user._id))
      .collect();

    const orderTypes = new Set(["order_status", "payment"]);
    const sellerTypes = new Set(["order_placed", "low_stock", "profile_visit", "store_visit"]);
    const wishlistTypes = new Set(["back_in_stock"]);
    const isActiveSeller = Boolean((user as any).isSeller || user.role === "seller") &&
      (user as any).marketplaceSubscriptionStatus !== "locked";

    return {
      cart: cartItems.reduce((sum, item) => sum + (item.quantity ?? 1), 0),
      orders: unread.filter((notification) => orderTypes.has(notification.type)).length,
      messages: receivedMessages.filter((message) => !message.isRead).length,
      wishlist: unread.filter((notification) => wishlistTypes.has(notification.type)).length,
      seller: isActiveSeller ? unread.filter((notification) => sellerTypes.has(notification.type)).length : 0,
    };
  },
});

export const markNotificationsBySurfaceRead = mutation({
  args: { surface: v.union(v.literal("orders"), v.literal("wishlist"), v.literal("seller")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await currentMarketplaceUser(ctx, identity);
    if (!user) return;

    const typeMap: Record<string, string[]> = {
      orders: ["order_status", "payment"],
      wishlist: ["back_in_stock"],
      seller: ["order_placed", "low_stock", "profile_visit", "store_visit"],
    };
    const types = new Set(typeMap[args.surface] ?? []);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    await Promise.all(
      notifications
        .filter((notification) => !notification.isRead && types.has(notification.type))
        .map((notification) => ctx.db.patch(notification._id, { isRead: true }))
    );
  },
});

export const markNotificationRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const n = await ctx.db.get(args.notificationId);
    if (!n) return;
    await ctx.db.patch(args.notificationId, { isRead: true });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await currentMarketplaceUser(ctx, identity);
    if (!user) return;
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    await Promise.all(unread.filter((n) => !n.isRead).map((n) => ctx.db.patch(n._id, { isRead: true })));
  },
});

export const recordProfileVisit = mutation({
  args: {
    userId: v.id("users"),
    surface: v.optional(v.union(v.literal("profile"), v.literal("store"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const visitor = await currentMarketplaceUser(ctx, identity);
    if (!visitor || visitor._id === args.userId) return false;

    const target = await ctx.db.get(args.userId);
    if (!target) return false;

    const surface = args.surface ?? "profile";
    const title = surface === "store" ? "Store visit" : "Profile visit";
    const body = `${visitor.name ?? "Someone"} viewed your ${surface === "store" ? "store" : "profile"}.`;

    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: surface === "store" ? "store_visit" : "profile_visit",
      title,
      body,
      link: `/storefront/${visitor._id}`,
      isRead: false,
    });

    await ctx.db.insert("activity", {
      userId: args.userId,
      action: body,
      meta: { visitorId: visitor._id, surface },
    });

    return true;
  },
});

// Current user's activity / sales history (most recent first).
export const getMyActivity = query({
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
      .query("activity")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);
  },
});
