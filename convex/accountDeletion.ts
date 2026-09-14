import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

async function currentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const authSubject = String(identity.subject ?? "").trim().split("|")[0];
  const stable = authSubject
    ? await ctx.db.query("users").withIndex("by_auth_subject", (q: any) => q.eq("authSubject", authSubject)).unique()
    : null;
  const user = stable
    ?? await ctx.db.query("users").withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!user) throw new Error("Account profile not found");
  return user;
}

async function deleteWhere(ctx: any, table: string, predicate: (doc: any) => boolean) {
  const docs = await ctx.db.query(table).collect();
  await Promise.all(docs.filter(predicate).map((doc: any) => ctx.db.delete(doc._id)));
}

export const scheduleDeletion = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    const scheduledFor = Date.now() + SEVEN_DAYS;
    await ctx.db.patch(user._id, {
      isPendingDeletion: true,
      deletionRequestedAt: Date.now(),
      deletionScheduledFor: scheduledFor,
    });
    await ctx.scheduler.runAt(scheduledFor, internal.accountDeletion.purgeScheduledAccount, { userId: user._id });
    return { scheduledFor };
  },
});

export const reactivateAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    await ctx.db.patch(user._id, {
      isPendingDeletion: false,
      deletionRequestedAt: undefined,
      deletionScheduledFor: undefined,
    });
  },
});

export const purgeImmediately = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    await purgeUser(ctx, user._id);
  },
});

export const purgeScheduledAccount = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user: any = await ctx.db.get(args.userId);
    if (!user || !user.isPendingDeletion || !user.deletionScheduledFor || user.deletionScheduledFor > Date.now()) return;
    await purgeUser(ctx, args.userId);
  },
});

async function purgeUser(ctx: any, userId: any) {
  const products = await ctx.db.query("products").withIndex("by_seller", (q: any) => q.eq("sellerId", userId)).collect();
  const productIds = new Set(products.map((product: any) => String(product._id)));

  for (const product of products) {
    for (const media of [...(product.images ?? []), ...(product.videos ?? [])]) {
      if (media && !String(media).startsWith("http")) {
        try { await ctx.storage.delete(media as any); } catch { /* orphaned media is non-blocking */ }
      }
    }
  }

  await deleteWhere(ctx, "messages", (d) => d.senderId === userId || d.receiverId === userId || productIds.has(String(d.productId)));
  await deleteWhere(ctx, "cartItems", (d) => d.userId === userId || productIds.has(String(d.productId)));
  await deleteWhere(ctx, "notifications", (d) => d.userId === userId);
  await deleteWhere(ctx, "activity", (d) => d.userId === userId);
  await deleteWhere(ctx, "follows", (d) => d.followerId === userId || d.followeeId === userId);
  await deleteWhere(ctx, "analyticsEvents", (d) => d.actorId === userId || d.sellerId === userId || productIds.has(String(d.productId)));
  await deleteWhere(ctx, "reviews", (d) => d.userId === userId || productIds.has(String(d.productId)));
  await deleteWhere(ctx, "wishlist", (d) => d.userId === userId || productIds.has(String(d.productId)));
  await deleteWhere(ctx, "rfqs", (d) => d.buyerId === userId || d.sellerId === userId || productIds.has(String(d.productId)));
  await deleteWhere(ctx, "reports", (d) => d.reporterId === userId || d.targetSellerId === userId || productIds.has(String(d.targetProductId)));
  await deleteWhere(ctx, "orders", (d) => d.userId === userId || d.buyerId === userId || d.sellerId === userId || productIds.has(String(d.productId)) || (d.items ?? []).some((item: any) => productIds.has(String(item.productId))));
  for (const product of products) await ctx.db.delete(product._id);

  const sessions = (await ctx.db.query("authSessions").collect()).filter((session: any) => session.userId === userId);
  const sessionIds = new Set(sessions.map((session: any) => String(session._id)));
  for (const session of sessions) {
    const tokens = (await ctx.db.query("authRefreshTokens").collect()).filter((token: any) => token.sessionId === session._id);
    for (const token of tokens) await ctx.db.delete(token._id);
    await ctx.db.delete(session._id);
  }
  const accounts = (await ctx.db.query("authAccounts").collect()).filter((account: any) => account.userId === userId);
  const accountIds = new Set(accounts.map((account: any) => String(account._id)));
  for (const account of accounts) await ctx.db.delete(account._id);

  await deleteWhere(ctx, "authVerificationCodes", (d) => d.userId === userId || accountIds.has(String(d.accountId)));
  await deleteWhere(ctx, "authVerifiers", (d) => d.userId === userId || accountIds.has(String(d.accountId)));
  await deleteWhere(ctx, "authRateLimits", (d) => d.userId === userId);
  await deleteWhere(ctx, "authRefreshTokens", (d) => sessionIds.has(String(d.sessionId)));

  const user = await ctx.db.get(userId);
  if (user?.avatarStorageId) {
    try { await ctx.storage.delete(user.avatarStorageId as any); } catch { /* orphaned media is non-blocking */ }
  }
  await ctx.db.delete(userId);
}