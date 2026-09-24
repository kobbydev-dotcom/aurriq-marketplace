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

async function resolveUserImage(ctx: any, user: any) {
  const value = user?.avatarStorageId ?? user?.image ?? user?.avatar;
  if (!value) return undefined;
  if (String(value).startsWith("http://") || String(value).startsWith("https://")) return value;
  try {
    return (await ctx.storage.getUrl(value as any)) ?? value;
  } catch {
    return value;
  }
}

function publicUser(user: any, image: string | undefined) {
  return {
    _id: user._id,
    name: user.name ?? "Aurriq Member",
    image,
    businessType: user.businessType,
    isVerified: user.isVerified,
    locationLabel: user.locationShared ? user.locationLabel : undefined,
    lastSeenAt: user.lastSeenAt,
  };
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
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.runMutation(internal.notifications.createNotification, {
        userId: args.userId,
        type: "unfollow",
        title: "Follower update",
        body: `${me.name ?? "Someone"} unfollowed you.`,
        link: `/storefront/${me._id}`,
      });
    }
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

export const getFollowers = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_followee", (q) => q.eq("followeeId", args.userId))
      .order("desc")
      .collect();
    const users: any[] = [];
    for (const follow of follows) {
      const user: any = await ctx.db.get(follow.followerId);
      if (user) users.push(publicUser(user, await resolveUserImage(ctx, user)));
    }
    return users;
  },
});

export const getFollowing = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .order("desc")
      .collect();
    const users: any[] = [];
    for (const follow of follows) {
      const user: any = await ctx.db.get(follow.followeeId);
      if (user) users.push(publicUser(user, await resolveUserImage(ctx, user)));
    }
    return users;
  },
});

// Sellers the current user follows ("Saved suppliers"), with details.
export const getSavedSuppliers = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", me._id))
      .order("desc")
      .collect();
    const result: any[] = [];
    for (const f of follows) {
      const seller: any = await ctx.db.get(f.followeeId);
      if (!seller) continue;
      result.push({
        _id: seller._id,
        name: seller.name,
        image: await resolveUserImage(ctx, seller),
        businessType: seller.businessType,
        isVerified: seller.isVerified,
        locationLabel: seller.locationShared ? seller.locationLabel : undefined,
      });
    }
    return result;
  },
});

// Products from sellers the current user follows (their "Following" feed).
// Turn a stored file id into a real web link (leave real links untouched).
async function resolveMediaUrl(ctx: any, value: any) {
  if (!value) return undefined;
  const s = String(value);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  try {
    return (await ctx.storage.getUrl(value as any)) ?? undefined;
  } catch {
    return undefined;
  }
}

// Products from sellers the current user follows (their "Following" feed).
export const getFollowedProducts = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", me._id))
      .take(200);
    const sellerIds = new Set(follows.map((f) => String(f.followeeId)));
    if (sellerIds.size === 0) return [];

    const products = await ctx.db.query("products").collect();
    const feed = products
      .filter((p: any) => p.isActive && sellerIds.has(String(p.sellerId)))
      .sort((a: any, b: any) => b._creationTime - a._creationTime)
      .slice(0, 40);

    return await Promise.all(
      feed.map(async (p: any) => {
        const seller: any = await ctx.db.get(p.sellerId);
        const images = (await Promise.all((p.images ?? []).map((i: any) => resolveMediaUrl(ctx, i)))).filter(Boolean);
        const videos = (await Promise.all((p.videos ?? []).map((i: any) => resolveMediaUrl(ctx, i)))).filter(Boolean);
        const imageUrl = await resolveMediaUrl(ctx, p.imageUrl);
        return {
          ...p,
          images,
          videos,
          imageUrl,
          sellerName: seller?.name ?? "Aurriq Seller",
          sellerBusinessType: seller?.businessType,
        };
      })
    );
  },
});
