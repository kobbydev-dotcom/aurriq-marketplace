import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function stableAuthSubject(identity: any) {
  const subject = String(identity?.subject ?? "").trim();
  return subject.split("|")[0] || undefined;
}

function identityEmail(identity: any) {
  const email = typeof identity?.email === "string" ? identity.email.trim().toLowerCase() : "";
  return email || undefined;
}

async function getUserById(ctx: any, userId: string | undefined) {
  if (!userId) return null;
  try {
    return await ctx.db.get(userId as any);
  } catch {
    return null;
  }
}

async function addUser(candidateMap: Map<string, any>, user: any) {
  if (user) candidateMap.set(String(user._id), user);
}

async function findCurrentUserGroup(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const authSubject = stableAuthSubject(identity);
  const email = identityEmail(identity);
  const candidates = new Map<string, any>();

  await addUser(candidates, await getUserById(ctx, authSubject));

  if (authSubject) {
    const subjectUsers = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q: any) => q.eq("authSubject", authSubject))
      .collect();
    for (const user of subjectUsers) await addUser(candidates, user);
  }

  if (identity.tokenIdentifier) {
    const tokenUsers = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .collect();
    for (const user of tokenUsers) await addUser(candidates, user);
  }

  if (email) {
    const emailUsers = await ctx.db
      .query("users")
      .withIndex("email", (q: any) => q.eq("email", email))
      .collect();
    for (const user of emailUsers) await addUser(candidates, user);

    const relatedAccounts = (await ctx.db.query("authAccounts").collect()).filter((account: any) => {
      return String(account.providerAccountId ?? "").trim().toLowerCase() === email
        || String(account.emailVerified ?? "").trim().toLowerCase() === email;
    });
    for (const account of relatedAccounts) {
      await addUser(candidates, await ctx.db.get(account.userId));
    }
  }

  const users = [...candidates.values()];
  if (users.length === 0) throw new Error("Account profile not found");
  return users;
}

async function deleteWhere(ctx: any, table: string, predicate: (doc: any) => boolean) {
  const docs = await ctx.db.query(table).collect();
  await Promise.all(docs.filter(predicate).map((doc: any) => ctx.db.delete(doc._id)));
}

export const scheduleDeletion = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await findCurrentUserGroup(ctx);
    const scheduledFor = Date.now() + SEVEN_DAYS;
    const requestedAt = Date.now();
    for (const user of users) {
      await ctx.db.patch(user._id, {
        isPendingDeletion: true,
        deletionRequestedAt: requestedAt,
        deletionScheduledFor: scheduledFor,
      });
      await ctx.scheduler.runAt(scheduledFor, internal.accountDeletion.purgeScheduledAccount, { userId: user._id });
    }
    return { scheduledFor };
  },
});

export const reactivateAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await findCurrentUserGroup(ctx);
    for (const user of users) {
      await ctx.db.patch(user._id, {
        isPendingDeletion: false,
        deletionRequestedAt: undefined,
        deletionScheduledFor: undefined,
      });
    }
  },
});

export const purgeImmediately = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await findCurrentUserGroup(ctx);
    await purgeUsers(ctx, users.map((user) => user._id));
  },
});

export const purgeScheduledAccount = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user: any = await ctx.db.get(args.userId);
    if (!user || !user.isPendingDeletion || !user.deletionScheduledFor || user.deletionScheduledFor > Date.now()) return;
    const userIds = [args.userId];
    if (user.email) {
      const related = await ctx.db
        .query("users")
        .withIndex("email", (q: any) => q.eq("email", String(user.email).trim().toLowerCase()))
        .collect();
      userIds.push(...related.filter((relatedUser: any) => relatedUser.isPendingDeletion).map((relatedUser: any) => relatedUser._id));
    }
    await purgeUsers(ctx, userIds);
  },
});

async function purgeUsers(ctx: any, userIds: any[]) {
  const uniqueIds = [...new Set(userIds.map((userId) => String(userId)))];
  for (const userId of uniqueIds) {
    if (await ctx.db.get(userId as any)) await purgeUser(ctx, userId as any);
  }
}

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
