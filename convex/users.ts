import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

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

function humanizeEmailLocalPart(email: string | undefined) {
  const local = String(email ?? "").split("@")[0].replace(/[._-]+/g, " ").trim();
  if (!local) return "";
  return local
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function identityDisplayName(identity: any, email: string | undefined) {
  const direct = String(identity?.name ?? "").trim();
  if (direct) return direct;
  const given = String(identity?.givenName ?? identity?.given_name ?? "").trim();
  const family = String(identity?.familyName ?? identity?.family_name ?? "").trim();
  if (given || family) return [given, family].filter(Boolean).join(" ");
  return humanizeEmailLocalPart(email);
}

function requiredIdentityDisplayName(identity: any, email: string | undefined) {
  const providerName = identityDisplayName(identity, email);
  if (providerName) return providerName;
  if (email) return humanizeEmailLocalPart(email);
  return "Aurriq Member";
}

function stableAuthSubject(identity: any) {
  const subject = typeof identity?.subject === "string" ? identity.subject.trim() : "";
  return subject.split("|")[0] || undefined;
}

function isAnonymousPlaceholder(name: string | null | undefined) {
  return !name || /^(anonymous buyer|anonymous|new user|user)$/i.test(name.trim());
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

async function findEmailUser(ctx: any, email: string) {
  const matches = await ctx.db.query("users").withIndex("email", (q: any) => q.eq("email", email)).collect();
  return matches.sort((a: any, b: any) => {
    const aScore = [a.name, a.phone, a.businessType, a.avatarStorageId, a.isSeller, a.role].filter(Boolean).length;
    const bScore = [b.name, b.phone, b.businessType, b.avatarStorageId, b.isSeller, b.role].filter(Boolean).length;
    return bScore - aScore || a._creationTime - b._creationTime;
  })[0] ?? null;
}

async function getAuthSubjectUser(ctx: any, authSubject: string | undefined) {
  if (!authSubject) return null;
  try {
    return await ctx.db.get(authSubject as any);
  } catch {
    return null;
  }
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}

async function mergeUserInto(ctx: any, duplicate: any, canonical: any) {
  if (!duplicate || !canonical || duplicate._id === canonical._id) return canonical;

  const copyFields = [
    "name",
    "email",
    "image",
    "phone",
    "avatar",
    "paymentMethod",
    "paymentNetwork",
    "paymentAccount",
    "businessType",
    "serviceTypes",
    "customServiceDescription",
    "notifyEmail",
    "avatarStorageId",
    "locationLabel",
    "latitude",
    "longitude",
    "locationShared",
    "doabookproSlug",
    "marketplaceSubscriptionStatus",
    "marketplacePlan",
    "marketplaceSubscriptionSource",
    "marketplacePaidUntil",
    "marketplacePaymentReference",
    "lastSeenAt",
    "lastAccessNotifiedAt",
  ];
  const patch: Record<string, unknown> = {};
  for (const field of copyFields) {
    if (!hasValue(canonical[field]) && hasValue(duplicate[field])) patch[field] = duplicate[field];
  }
  if (isAnonymousPlaceholder(canonical.name) && !isAnonymousPlaceholder(duplicate.name)) patch.name = duplicate.name;
  if (duplicate.isSeller === true) patch.isSeller = true;
  if (duplicate.role === "seller" && !canonical.role) patch.role = "seller";
  if (duplicate.isVerified === true) patch.isVerified = true;
  if (duplicate.isPendingDeletion !== true && canonical.isPendingDeletion === true) {
    patch.isPendingDeletion = false;
    patch.deletionRequestedAt = undefined;
    patch.deletionScheduledFor = undefined;
  }
  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(canonical._id, patch as any);
    canonical = { ...canonical, ...patch };
  }

  const replace = async (table: string, predicate: (doc: any) => boolean, patchDoc: (doc: any) => Record<string, unknown>) => {
    const docs = await ctx.db.query(table).collect();
    for (const doc of docs.filter(predicate)) await ctx.db.patch(doc._id, patchDoc(doc));
  };

  await replace("messages", (d) => d.senderId === duplicate._id || d.receiverId === duplicate._id, (d) => ({ senderId: d.senderId === duplicate._id ? canonical._id : d.senderId, receiverId: d.receiverId === duplicate._id ? canonical._id : d.receiverId }));
  await replace("cartItems", (d) => d.userId === duplicate._id, () => ({ userId: canonical._id }));
  await replace("notifications", (d) => d.userId === duplicate._id, () => ({ userId: canonical._id }));
  await replace("activity", (d) => d.userId === duplicate._id, () => ({ userId: canonical._id }));
  await replace("follows", (d) => d.followerId === duplicate._id || d.followeeId === duplicate._id, (d) => ({ followerId: d.followerId === duplicate._id ? canonical._id : d.followerId, followeeId: d.followeeId === duplicate._id ? canonical._id : d.followeeId }));
  await replace("analyticsEvents", (d) => d.actorId === duplicate._id || d.sellerId === duplicate._id, (d) => ({ actorId: d.actorId === duplicate._id ? canonical._id : d.actorId, sellerId: d.sellerId === duplicate._id ? canonical._id : d.sellerId }));
  await replace("reviews", (d) => d.userId === duplicate._id, () => ({ userId: canonical._id }));
  await replace("wishlist", (d) => d.userId === duplicate._id, () => ({ userId: canonical._id }));
  await replace("rfqs", (d) => d.buyerId === duplicate._id || d.sellerId === duplicate._id, (d) => ({ buyerId: d.buyerId === duplicate._id ? canonical._id : d.buyerId, sellerId: d.sellerId === duplicate._id ? canonical._id : d.sellerId }));
  await replace("reports", (d) => d.reporterId === duplicate._id || d.targetSellerId === duplicate._id, (d) => ({ reporterId: d.reporterId === duplicate._id ? canonical._id : d.reporterId, targetSellerId: d.targetSellerId === duplicate._id ? canonical._id : d.targetSellerId }));
  await replace("orders", (d) => d.userId === duplicate._id || d.buyerId === duplicate._id || d.sellerId === duplicate._id, (d) => ({ userId: d.userId === duplicate._id ? canonical._id : d.userId, buyerId: d.buyerId === duplicate._id ? canonical._id : d.buyerId, sellerId: d.sellerId === duplicate._id ? canonical._id : d.sellerId }));
  await replace("products", (d) => d.sellerId === duplicate._id, () => ({ sellerId: canonical._id }));
  await replace("authSessions", (d) => d.userId === duplicate._id, () => ({ userId: canonical._id }));
  await replace("authAccounts", (d) => d.userId === duplicate._id, () => ({ userId: canonical._id }));
  await replace("authVerificationCodes", (d) => d.userId === duplicate._id, () => ({ userId: canonical._id }));
  await replace("authVerifiers", (d) => d.userId === duplicate._id, () => ({ userId: canonical._id }));
  await replace("authRateLimits", (d) => d.userId === duplicate._id, () => ({ userId: canonical._id }));

  if (duplicate.avatarStorageId && duplicate.avatarStorageId !== canonical.avatarStorageId && canonical.avatarStorageId) {
    try { await ctx.storage.delete(duplicate.avatarStorageId as any); } catch { /* stale avatar cleanup is non-blocking */ }
  }
  await ctx.db.delete(duplicate._id);
  return canonical;
}

async function canonicalUserForIdentity(ctx: any, identity: any, identityEmail?: string) {
  const authSubject = stableAuthSubject(identity);
  let user = await getAuthSubjectUser(ctx, authSubject);

  const shadow = authSubject
    ? await ctx.db.query("users").withIndex("by_auth_subject", (q: any) => q.eq("authSubject", authSubject)).unique()
    : null;
  if (user && shadow && shadow._id !== user._id) user = await mergeUserInto(ctx, shadow, user);
  if (!user && shadow) user = shadow;

  const tokenUser = await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (user && tokenUser && tokenUser._id !== user._id) user = await mergeUserInto(ctx, tokenUser, user);
  if (!user && tokenUser) user = tokenUser;

  if (identityEmail) {
    const emailUser = await findEmailUser(ctx, identityEmail);
    if (user && emailUser && emailUser._id !== user._id) user = await mergeUserInto(ctx, emailUser, user);
    if (!user && emailUser) user = emailUser;
  }

  return { user, authSubject };
}

async function findNameUser(ctx: any, name: string, excludeUserId?: any) {
  const normalized = normalizeName(name);
  const users = await ctx.db.query("users").collect();
  return users.find((user: any) => user._id !== excludeUserId && normalizeName(String(user.name ?? "")) === normalized) ?? null;
}

async function scheduleAccountAccessAlerts(ctx: any, user: any, accessNow: number) {
  const when = new Date(accessNow).toISOString();
  const bodyLines = [
    `A sign-in to your Aurriq account was detected at ${when}.`,
    "If this was not you, reset your password and contact Aurriq support immediately.",
  ];

  await ctx.db.insert("notifications", {
    userId: user._id,
    type: "account_access",
    title: "Your Aurriq account was accessed",
    body: bodyLines.join(" "),
    link: "/profile",
    isRead: false,
  });

  const email = user.notifyEmail ?? user.email;
  if (email) {
    await ctx.scheduler.runAfter(0, internal.mail.sendEmail, {
      to: email,
      subject: "New sign-in to your Aurriq account",
      heading: `Account access detected${user.name ? `, ${user.name}` : ""}`,
      bodyLines,
      ctaText: "Review my profile",
      ctaUrl: `${process.env.AURRIQ_PUBLIC_URL ?? "https://aurriq-marketplace-live-a04ea8311137.herokuapp.com"}/profile`,
    });
  }

  if (user.phone) {
    await ctx.scheduler.runAfter(0, internal.sms.sendSMS, {
      to: user.phone,
      message: `AURRIQ: New sign-in detected at ${when}. If this was not you, reset your password and contact support immediately.`,
    });
  }
}

export const emailAvailability = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!email) return { available: false, message: "Enter an email address." };
    const user = await findEmailUser(ctx, email);
    return user
      ? { available: false, message: "This email is already in use. Sign in instead." }
      : { available: true, message: "" };
  },
});

export const nameAvailability = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) return { available: false, message: "Enter a display name." };
    const identity = await ctx.auth.getUserIdentity();
    const authSubject = identity ? stableAuthSubject(identity) : undefined;
    const current = identity
      ? await getAuthSubjectUser(ctx, authSubject)
        ?? (authSubject ? await ctx.db.query("users").withIndex("by_auth_subject", (q: any) => q.eq("authSubject", authSubject)).unique() : null)
        ?? await ctx.db.query("users").withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique()
      : null;
    const user = await findNameUser(ctx, name, current?._id);
    return user
      ? { available: false, message: "That display name is already in use. Choose another one." }
      : { available: true, message: "" };
  },
});

// Public: sellers/service businesses who opted in to share their shop location,
// sorted by distance from the given coordinates.
// Public: a seller's storefront by Convex user id or DOABookPro slug — used by
// the DOABookPro client booking page to embed the owner's shop.
export const getStorefront = query({
  args: {
    sellerId: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let seller: any = null;
    if (args.sellerId) {
      try {
        seller = await ctx.db.get(args.sellerId as any);
      } catch {
        seller = null;
      }
    } else if (args.slug) {
      const all = await ctx.db.query("users").collect();
      seller = all.find((u: any) => u.doabookproSlug === args.slug) ?? null;
    }
    if (!seller) return null;

    const products = await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
      .collect();
    const active = products.filter((p: any) => p.isActive);

    // Resolve cover images to displayable URLs.
    const resolve = async (m: string | undefined) => {
      if (!m) return "";
      if (m.startsWith("http")) return m;
      try {
        return (await ctx.storage.getUrl(m as any)) ?? m;
      } catch {
        return m;
      }
    };

    const productCards = await Promise.all(
      active.slice(0, 12).map(async (p: any) => ({
        _id: p._id,
        name: p.name,
        brand: p.brand,
        price: p.promoPrice ?? p.originalPrice,
        originalPrice: p.originalPrice,
        image: await resolve(p.images?.[0]),
        category: p.category,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
      }))
    );

    const followers = await ctx.db
      .query("follows")
      .withIndex("by_followee", (q) => q.eq("followeeId", seller._id))
      .collect();

    return {
      seller: {
        _id: seller._id,
        name: seller.name,
        image: seller.image ?? seller.avatar,
        businessType: seller.businessType,
        isVerified: seller.isVerified,
        locationLabel: seller.locationShared ? seller.locationLabel : undefined,
        doabookproSlug: seller.doabookproSlug,
      },
      productCount: active.length,
      followerCount: followers.length,
      products: productCards,
    };
  },
});

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
        latitude: s.latitude,
        longitude: s.longitude,
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

    const identityEmail = typeof (identity as any).email === "string"
      ? String((identity as any).email).trim().toLowerCase()
      : undefined;
    const authSubject = stableAuthSubject(identity);
    const providerName = requiredIdentityDisplayName(identity, identityEmail);
    const providerImage = identity.picture || (identity as any).pictureUrl || undefined;
    const accessNow = Date.now();

    // Convex Auth stores the signed-in account in `users` too. Treat that auth
    // row as the marketplace member, and merge any older shadow profile into it.
    let { user } = await canonicalUserForIdentity(ctx, identity, identityEmail);

    if (user === null) {
      const legacySubject = typeof (identity as any).subject === "string"
        ? String((identity as any).subject).trim()
        : "";
      if (legacySubject && authSubject) {
        const candidates = await ctx.db.query("users").collect();
        user = candidates.find((candidate: any) =>
          candidate.authSubject === legacySubject || candidate.authSubject?.startsWith(`${authSubject}|`)
        ) ?? null;
      }
    }

    if (user === null) {
      user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
        .unique();
    }

    if (user !== null) {
      const patch: Record<string, unknown> = { lastSeenAt: Date.now() };
      if (!user.email && identityEmail) patch.email = identityEmail;
      if (!user.authSubject && authSubject) patch.authSubject = authSubject;
      if (isAnonymousPlaceholder(user.name) && providerName) patch.name = providerName;
      if (!user.image && providerImage) patch.image = providerImage;
      if (!user.tokenIdentifier || user.tokenIdentifier !== identity.tokenIdentifier) {
        patch.tokenIdentifier = identity.tokenIdentifier;
      }
      if (!user.lastAccessNotifiedAt || accessNow - user.lastAccessNotifiedAt > 15 * 60 * 1000) {
        patch.lastAccessNotifiedAt = accessNow;
        await scheduleAccountAccessAlerts(ctx, user, accessNow);
      }
      if (Object.keys(patch).length > 0) await ctx.db.patch(user._id, patch as any);
      return user._id;
    }

    if (identityEmail) {
      user = await findEmailUser(ctx, identityEmail);
      if (user) {
        if (user.authSubject && authSubject && user.authSubject !== authSubject) {
          throw new Error("This email is already in use. Sign in with the account's original login method.");
        }
        const patch: Record<string, unknown> = {
          tokenIdentifier: identity.tokenIdentifier,
        };
        if (authSubject) patch.authSubject = authSubject;
        if (isAnonymousPlaceholder(user.name) && providerName) patch.name = providerName;
        if (!user.image && providerImage) patch.image = providerImage;
        if (!user.lastAccessNotifiedAt || accessNow - user.lastAccessNotifiedAt > 15 * 60 * 1000) {
          patch.lastAccessNotifiedAt = accessNow;
          await scheduleAccountAccessAlerts(ctx, user, accessNow);
        }
        await ctx.db.patch(user._id, patch as any);
        return user._id;
      }
    }

    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier!,
      authSubject,
      email: identityEmail,
      name: providerName,
      image: providerImage,
      isSeller: false,
      isVerified: false,
      lastSeenAt: Date.now(),
    });
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const identityEmail = typeof (identity as any).email === "string"
      ? String((identity as any).email).trim().toLowerCase()
      : undefined;
    const authSubject = stableAuthSubject(identity);
    const authUser = await getAuthSubjectUser(ctx, authSubject);
    if (authUser) return authUser;

    if (authSubject) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_auth_subject", (q) => q.eq("authSubject", authSubject))
        .unique();
      if (user) return user;

      const legacySubject = typeof (identity as any).subject === "string"
        ? String((identity as any).subject).trim()
        : "";
      const candidates = await ctx.db.query("users").collect();
      const legacyUser = candidates.find((candidate: any) =>
        candidate.authSubject === legacySubject || candidate.authSubject?.startsWith(`${authSubject}|`)
      );
      if (legacyUser) return legacyUser;
    }

    const tokenUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (tokenUser) return tokenUser;

    return identityEmail ? await findEmailUser(ctx, identityEmail) : null;
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
    serviceTypes: v.optional(v.array(v.string())),
    customServiceDescription: v.optional(v.string()),
    notifyEmail: v.optional(v.string()),
    avatarStorageId: v.optional(v.string()),
    locationLabel: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    locationShared: v.optional(v.boolean()),
    doabookproSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const identityEmail = typeof (identity as any).email === "string"
      ? String((identity as any).email).trim().toLowerCase()
      : undefined;

    let { user, authSubject } = await canonicalUserForIdentity(ctx, identity, identityEmail);

    if (typeof args.name === "string") {
      const requestedName = args.name.trim();
      if (!requestedName) throw new Error("Name cannot be empty");
      const nameOwner = await findNameUser(ctx, requestedName, user?._id);
      if (nameOwner) throw new Error("That display name is already in use. Choose another one.");
    }

    if (!user) {
      const userId = await ctx.db.insert("users", {
        tokenIdentifier: identity.tokenIdentifier!,
        email: identityEmail,
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
        authSubject,
      });
      user = await ctx.db.get(userId);
    }

    const patch: Record<string, unknown> = {};

    if (typeof args.name === "string") patch.name = args.name.trim();

    if (typeof args.phone === "string") patch.phone = args.phone.trim();
    if (typeof args.role === "string") patch.role = args.role;
    if (typeof args.paymentMethod === "string") patch.paymentMethod = args.paymentMethod;
    if (typeof args.paymentNetwork === "string") patch.paymentNetwork = args.paymentNetwork;
    if (typeof args.paymentAccount === "string") patch.paymentAccount = args.paymentAccount;
    if (typeof args.businessType === "string") patch.businessType = args.businessType;
    if (Array.isArray(args.serviceTypes)) patch.serviceTypes = args.serviceTypes.map((service) => service.trim()).filter(Boolean);
    if (typeof args.customServiceDescription === "string") patch.customServiceDescription = args.customServiceDescription.trim();
    if (typeof args.notifyEmail === "string") patch.notifyEmail = args.notifyEmail.trim();
    if (typeof args.avatarStorageId === "string") patch.avatarStorageId = args.avatarStorageId;
    if (typeof args.locationLabel === "string") patch.locationLabel = args.locationLabel.trim();
    if (typeof args.latitude === "number") patch.latitude = args.latitude;
    if (typeof args.longitude === "number") patch.longitude = args.longitude;
    if (typeof args.locationShared === "boolean") patch.locationShared = args.locationShared;
    if (typeof args.doabookproSlug === "string") patch.doabookproSlug = args.doabookproSlug.trim();
    if (typeof args.isSeller === "boolean") patch.isSeller = args.isSeller;
    if (args.role === "seller") patch.isSeller = true;
    if (identityEmail && !user?.email) patch.email = identityEmail;
    if (authSubject && !user?.authSubject && user?._id !== authSubject) patch.authSubject = authSubject;
    if (!user?.tokenIdentifier || user.tokenIdentifier !== identity.tokenIdentifier) {
      patch.tokenIdentifier = identity.tokenIdentifier;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user!._id, patch as any);
    }

    return true;
  },
});

export const sendPasswordResetNotice = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user: any = await ctx.runQuery(api.users.findByEmail, { email: args.email.trim().toLowerCase() });
    if (!user?.email) throw new Error("No Aurriq account was found for that email");
    if (user.phone) {
      await ctx.runAction(internal.sms.sendSMS, {
        to: user.phone,
        message: "Aurriq: A password reset code was requested for your account. Check your login email. If this was not you, contact support.",
      });
    }
    return { email: user.email, phoneNotified: Boolean(user.phone) };
  },
});

export const findByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await findEmailUser(ctx, args.email.trim().toLowerCase());
    if (!user) return null;
    return { email: user.email, phone: user.phone };
  },
});

export const hasPasswordAccount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const identityEmail = typeof (identity as any).email === "string"
      ? String((identity as any).email).trim().toLowerCase()
      : undefined;
    const authSubject = stableAuthSubject(identity);
    const user = await getAuthSubjectUser(ctx, authSubject)
      ?? (authSubject ? await ctx.db.query("users").withIndex("by_auth_subject", (q: any) => q.eq("authSubject", authSubject)).unique() : null)
      ?? await ctx.db.query("users").withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique()
      ?? (identityEmail ? await findEmailUser(ctx, identityEmail) : null);
    if (!user) return false;
    const accounts = await ctx.db.query("authAccounts").withIndex("userIdAndProvider", (q: any) => q.eq("userId", user._id).eq("provider", "password")).collect();
    return accounts.length > 0;
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
