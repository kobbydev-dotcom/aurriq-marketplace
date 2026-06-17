import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const storeUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called storeUser without authentication");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    const name = identity.name ?? user?.name ?? "Anonymous Buyer";
    // Safely handle picture (some providers use picture, some pictureUrl)
    const imageUrl = identity.picture || (identity as any).pictureUrl || undefined;

    if (user !== null) {
      // Update if changed
      if (user.name !== name || user.image !== imageUrl) {
        await ctx.db.patch(user._id, {
          name,
          image: imageUrl,
        });
      }
      return user._id;
    }

    // First time user
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.subject,
      name,
      image: imageUrl,
      isSeller: false,
      isVerified: false,
    });
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
      
    return user;
  },
});

export const updateProfile = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      name: args.name,
    });

    return true;
  },
});