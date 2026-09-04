import { mutation, query } from "./_generated/server";
import { internalMutation } from "./_generated/server";
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
    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      link: args.link,
      isRead: false,
    });
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
