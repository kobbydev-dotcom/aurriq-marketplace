import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Haversine distance in kilometers between two coordinates.
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Public: sellers/service businesses who opted in to share their shop location,
// sorted by distance from the given coordinates.
export const getNearbyShops = query({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    radiusKm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sellers = await ctx.db.query("users").collect();
    const radius = args.radiusKm ?? 50;

    const withDistance = sellers
      .filter(
        (s: any) =>
          s.locationShared &&
          typeof s.latitude === "number" &&
          typeof s.longitude === "number"
      )
      .map((s: any) => ({
        _id: s._id,
        name: s.name,
        image: s.image ?? s.avatar,
        businessType: s.businessType,
        isVerified: s.isVerified,
        locationLabel: s.locationLabel,
        distanceKm: distanceKm(args.latitude, args.longitude, s.latitude, s.longitude),
      }))
      .filter((s: any) => s.distanceKm <= radius)
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm);

    return withDistance;
  },
});

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

    const name = user?.name ?? identity.name ?? "Anonymous Buyer";
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
    businessType: v.optional(v.string()),
    notifyEmail: v.optional(v.string()),
    avatarStorageId: v.optional(v.string()),
    locationLabel: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    locationShared: v.optional(v.boolean()),
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
    if (typeof args.businessType === "string") patch.businessType = args.businessType;
    if (typeof args.notifyEmail === "string") patch.notifyEmail = args.notifyEmail.trim();
    if (typeof args.avatarStorageId === "string") patch.avatarStorageId = args.avatarStorageId;
    if (typeof args.locationLabel === "string") patch.locationLabel = args.locationLabel.trim();
    if (typeof args.latitude === "number") patch.latitude = args.latitude;
    if (typeof args.longitude === "number") patch.longitude = args.longitude;
    if (typeof args.locationShared === "boolean") patch.locationShared = args.locationShared;
    if (typeof args.isSeller === "boolean") patch.isSeller = args.isSeller;
    if (args.role === "seller") patch.isSeller = true;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user!._id, patch as any);
    }

    return true;
  },
});

// Resolve an avatar value (storage id or external URL) to a displayable URL.
export const resolveAvatarUrl = query({
  args: { storageId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.storageId) return null;
    if (args.storageId.startsWith("http")) return args.storageId;
    try {
      return await ctx.storage.getUrl(args.storageId as any);
    } catch {
      return null;
    }
  },
});

// Generate an upload URL for avatar upload (reuses product storage upload).
export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});