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
