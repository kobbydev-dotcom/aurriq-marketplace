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
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.optional(v.string()),
    isSeller: v.optional(v.boolean()),
    paymentMethod: v.optional(v.string()),
    paymentNetwork: v.optional(v.string()),
    paymentAccount: v.optional(v.string()),
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

    if (!user) {
      const userId = await ctx.db.insert("users", {
        tokenIdentifier: identity.tokenIdentifier!,
        name: (args.name?.trim() || identity.name || "New User").trim(),
        // Cast to string or undefined explicitly to satisfy TypeScript
        image: typeof identity.picture === 'string' ? identity.picture : undefined,
        isSeller: args.isSeller ?? (args.role === "seller"),
        isVerified: false,
        phone: args.phone,
        role: args.role,
        paymentMethod: args.paymentMethod,
        paymentNetwork: args.paymentNetwork,
        paymentAccount: args.paymentAccount,
      });
      user = await ctx.db.get(userId);
    }

    const patch: Record<string, unknown> = {};

    if (typeof args.name === "string") {
      const trimmedName = args.name.trim();
      if (trimmedName.length === 0) {
        throw new Error("Name cannot be empty");
      }
      patch.name = trimmedName;
    }

    if (typeof args.phone === "string") patch.phone = args.phone.trim();
    if (typeof args.role === "string") patch.role = args.role;
    if (typeof args.paymentMethod === "string") patch.paymentMethod = args.paymentMethod;
    if (typeof args.paymentNetwork === "string") patch.paymentNetwork = args.paymentNetwork;
    if (typeof args.paymentAccount === "string") patch.paymentAccount = args.paymentAccount;
    if (typeof args.isSeller === "boolean") patch.isSeller = args.isSeller;
    if (args.role === "seller") patch.isSeller = true;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user!._id, patch as any);
    }

    return true;
  },
});