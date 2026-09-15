import { mutation } from "./_generated/server";
import { v } from "convex/values";

const TABLES = [
  "messages",
  "cartItems",
  "notifications",
  "activity",
  "follows",
  "analyticsEvents",
  "reviews",
  "wishlist",
  "rfqs",
  "reports",
  "orders",
  "authRefreshTokens",
  "authSessions",
  "authAccounts",
  "authVerificationCodes",
  "authVerifiers",
  "authRateLimits",
] as const;

async function deleteUserRelatedRecords(ctx: any, userId: any) {
  for (const table of TABLES) {
    const docs = await ctx.db.query(table).collect();
    const matches = docs.filter((doc: any) => {
      if (table === "messages") return doc.senderId === userId || doc.receiverId === userId;
      if (table === "cartItems") return doc.userId === userId;
      if (table === "notifications") return doc.userId === userId;
      if (table === "activity") return doc.userId === userId;
      if (table === "follows") return doc.followerId === userId || doc.followeeId === userId;
      if (table === "analyticsEvents") return doc.actorId === userId || doc.sellerId === userId;
      if (table === "reviews") return doc.userId === userId;
      if (table === "wishlist") return doc.userId === userId;
      if (table === "rfqs") return doc.buyerId === userId || doc.sellerId === userId;
      if (table === "reports") return doc.reporterId === userId || doc.targetSellerId === userId;
      if (table === "orders") return doc.userId === userId || doc.buyerId === userId || doc.sellerId === userId;
      return false;
    });

    await Promise.all(matches.map((doc: any) => ctx.db.delete(doc._id)));
  }

  const products = await ctx.db.query("products").collect();
  const sellerProducts = products.filter((product: any) => product.sellerId === userId);
  for (const product of sellerProducts) {
    for (const media of [...(product.images ?? []), ...(product.videos ?? [])]) {
      if (media && !String(media).startsWith("http")) {
        try { await ctx.storage.delete(media as any); } catch { /* orphaned media is non-blocking */ }
      }
    }
    await ctx.db.delete(product._id);
  }

  const user = await ctx.db.get(userId);
  if (user?.avatarStorageId) {
    try { await ctx.storage.delete(user.avatarStorageId as any); } catch { /* orphaned media is non-blocking */ }
  }

  await ctx.db.delete(userId);
}

function isAnonymousBuyer(user: any) {
  return String(user.name ?? "").trim().toLowerCase() === "anonymous buyer";
}

export const purgeAllAurriqTestData = mutation({
  args: { confirmation: v.literal("PURGE_ALL_AURRIQ_TEST_DATA") },
  handler: async (ctx) => {
    const counts: Record<string, number> = {};

    for (const table of TABLES) {
      const docs = await ctx.db.query(table).collect();
      counts[table] = docs.length;
      await Promise.all(docs.map((doc: any) => ctx.db.delete(doc._id)));
    }

    const products = await ctx.db.query("products").collect();
    counts.products = products.length;
    for (const product of products) {
      for (const media of [...(product.images ?? []), ...(product.videos ?? [])]) {
        if (media && !String(media).startsWith("http")) {
          try { await ctx.storage.delete(media as any); } catch { /* orphaned media is non-blocking */ }
        }
      }
      await ctx.db.delete(product._id);
    }

    const users = await ctx.db.query("users").collect();
    counts.users = users.length;
    for (const user of users) {
      if (user.avatarStorageId) {
        try { await ctx.storage.delete(user.avatarStorageId as any); } catch { /* orphaned media is non-blocking */ }
      }
      await ctx.db.delete(user._id);
    }

    return { purged: true, counts };
  },
});

export const purgeAnonymousBuyers = mutation({
  args: { confirmation: v.literal("PURGE_ANONYMOUS_BUYERS") },
  handler: async (ctx, args) => {
    if (args.confirmation !== "PURGE_ANONYMOUS_BUYERS") {
      throw new Error("Invalid confirmation");
    }

    const users = await ctx.db.query("users").collect();
    const anonymousBuyers = users.filter(isAnonymousBuyer);
    const deleted: string[] = [];

    for (const user of anonymousBuyers) {
      await deleteUserRelatedRecords(ctx, user._id);
      deleted.push(user._id as any);
    }

    return { deleted, count: deleted.length };
  },
});

export const cleanupDummyMarketplaceUsers = mutation({
  args: {
    confirmation: v.literal("REMOVE_DUMMY_AURRIQ_USERS"),
    userIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const deleted: string[] = [];
    const skipped: string[] = [];

    for (const userId of args.userIds) {
      const user = await ctx.db.get(userId);
      if (!user) {
        skipped.push(userId as any);
        continue;
      }

      const isClearlyDummy =
        !String(user.email ?? "").trim() ||
        /^(anonymous buyer|anonymous|new user|user|test|dummy|sample|qa|demo)$/i.test(String(user.name ?? ""));

      if (!isClearlyDummy) {
        skipped.push(userId as any);
        continue;
      }

      await deleteUserRelatedRecords(ctx, userId);
      deleted.push(userId as any);
    }

    return { deleted, skipped };
  },
});

export const mergeDuplicateUser = mutation({
  args: {
    duplicateUserId: v.id("users"),
    canonicalUserId: v.id("users"),
    confirmation: v.literal("MERGE_AURRIQ_DUPLICATE_USER"),
  },
  handler: async (ctx, args) => {
    if (args.duplicateUserId === args.canonicalUserId) throw new Error("Users must be different");
    const duplicate: any = await ctx.db.get(args.duplicateUserId);
    const canonical: any = await ctx.db.get(args.canonicalUserId);
    if (!duplicate || !canonical) throw new Error("Both user records must exist");
    if (!duplicate.email || duplicate.email.trim().toLowerCase() !== canonical.email?.trim().toLowerCase()) {
      throw new Error("Users must have the same email");
    }

    const copyFields = ["name", "image", "phone", "avatar", "paymentMethod", "paymentNetwork", "paymentAccount", "businessType", "serviceTypes", "customServiceDescription", "notifyEmail", "avatarStorageId", "locationLabel", "latitude", "longitude", "locationShared", "doabookproSlug", "marketplaceSubscriptionStatus", "marketplacePlan", "marketplaceSubscriptionSource", "marketplacePaidUntil", "marketplacePaymentReference"];
    const patch: Record<string, unknown> = {};
    for (const field of copyFields) {
      if (canonical[field] === undefined && duplicate[field] !== undefined) patch[field] = duplicate[field];
    }
    if (Object.keys(patch).length > 0) await ctx.db.patch(canonical._id, patch);

    const replace = async (table: string, predicate: (doc: any) => boolean, patchDoc: (doc: any) => Record<string, unknown>) => {
      const docs = await (ctx.db as any).query(table).collect();
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

    await ctx.db.delete(duplicate._id);
    return { merged: duplicate._id, kept: canonical._id };
  },
});
