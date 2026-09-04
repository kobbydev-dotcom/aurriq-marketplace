import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

// Follow a user. Idempotent.
export const follow = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    if (me._id === args.userId) throw new Error("You can't follow yourself");

    const existing = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) => q.eq("followerId", me._id).eq("followeeId", args.userId))
      .unique();
    if (existing) return existing._id;

    const id = await ctx.db.insert("follows", { followerId: me._id, followeeId: args.userId });

    const target: any = await ctx.db.get(args.userId);
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: args.userId,
      type: "follow",
      title: "New follower",
      body: `${me.name ?? "Someone"} started following you.`,
      link: "/profile",
    });
    await ctx.runMutation(internal.notifications.logActivity, {
      userId: args.userId,
      action: `${me.name ?? "Someone"} followed you`,
      meta: { followerId: me._id },
    });
    return id;
  },
});

// Unfollow a user.
export const unfollow = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) => q.eq("followerId", me._id).eq("followeeId", args.userId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return true;
  },
});

// Is the current user following the given user?
export const isFollowing = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return false;
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) => q.eq("followerId", me._id).eq("followeeId", args.userId))
      .unique();
    return !!existing;
  },
});

// Follower / following counts for a user.
export const getFollowCounts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_followee", (q) => q.eq("followeeId", args.userId))
      .collect();
    const following = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();
    return { followers: followers.length, following: following.length };
  },
});

// Products from sellers the current user follows (their "Following" feed).
export const getFollowedProducts = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", me._id))
      .collect();
    const sellerIds = new Set(follows.map((f) => f.followeeId));
    if (sellerIds.size === 0) return [];

    const products = await ctx.db.query("products").collect();
    const feed = products
      .filter((p: any) => p.isActive && sellerIds.has(p.sellerId))
      .sort((a: any, b: any) => b._creationTime - a._creationTime)
      .slice(0, 40);

    return await Promise.all(
      feed.map(async (p: any) => {
        const seller: any = await ctx.db.get(p.sellerId);
        return {
          ...p,
          sellerName: seller?.name ?? "Aurriq Seller",
          sellerBusinessType: seller?.businessType,
        };
      })
    );
  },
});
