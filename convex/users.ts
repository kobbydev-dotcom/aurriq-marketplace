import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const storeUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called storeUser without authentication");
    }

    // Using tokenIdentifier as it is the standard for Convex Auth indexes
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    const name = identity.name ?? user?.name ?? "Anonymous Buyer";
    const imageUrl = identity.picture || (identity as any).pictureUrl || undefined;

    if (user !== null) {
      if (user.name !== name || user.image !== imageUrl) {
        await ctx.db.patch(user._id, {
          name,
          image: imageUrl,
        });
      }
      return user._id;
    }

    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier!,
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

    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
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

    // 1. Try to find the user
    let user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier!))
      .unique();

    // ... inside updateProfile mutation
    if (!user) {
      const userId = await ctx.db.insert("users", {
        tokenIdentifier: identity.tokenIdentifier!,
        name: args.name.trim() || identity.name || "New User",
        // Cast to string or undefined explicitly to satisfy TypeScript
        image: typeof identity.picture === 'string' ? identity.picture : undefined,
        isSeller: false,
        isVerified: false,
      });
      user = await ctx.db.get(userId);
    }

    // 3. Now we are guaranteed that 'user' exists. Patch it.
    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new Error("Name cannot be empty");
    }

    await ctx.db.patch(user!._id, {
      name: trimmedName,
    });

    return true;
  },
});