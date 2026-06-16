import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

async function getAdminUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

function isAdmin(user: { role?: string; isVerified?: boolean } | null): boolean {
  return !!(user && user.role === "seller" && user.isVerified === true);
}

export const verifySellerById = mutation({
  args: {
    userId: v.id("users"),
    verified: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!isAdmin(admin)) throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });

    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    await ctx.db.patch(args.userId, { isVerified: args.verified });
  },
});

export const listSellers = query({
  args: {},
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!isAdmin(admin)) return [];

    const allUsers = await ctx.db.query("users").collect();
    const sellers = allUsers.filter((u) => u.role === "seller");

    return await Promise.all(
      sellers.map(async (seller) => {
        const products = await ctx.db
          .query("products")
          .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
          .collect();
        return { ...seller, productCount: products.length };
      })
    );
  },
});

export const listReportsAdmin = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!isAdmin(admin)) return [];

    const validStatuses = ["pending", "reviewed", "resolved", "dismissed"] as const;
    type ReportStatus = (typeof validStatuses)[number];

    const status =
      args.status && (validStatuses as readonly string[]).includes(args.status)
        ? (args.status as ReportStatus)
        : "pending";

    const reports = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", status))
      .order("desc")
      .take(100);

    return await Promise.all(
      reports.map(async (r) => {
        const reporter = await ctx.db.get(r.reporterId);
        const product = r.targetProductId ? await ctx.db.get(r.targetProductId) : null;
        const seller = r.targetSellerId ? await ctx.db.get(r.targetSellerId) : null;
        return {
          ...r,
          reporterName: reporter?.name ?? "Unknown",
          productName: product?.name,
          sellerName: seller?.name,
        };
      })
    );
  },
});

export const updateReportStatusAdmin = mutation({
  args: {
    reportId: v.id("reports"),
    status: v.union(
      v.literal("reviewed"),
      v.literal("resolved"),
      v.literal("dismissed")
    ),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!isAdmin(admin)) throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });

    await ctx.db.patch(args.reportId, {
      status: args.status,
      adminNote: args.adminNote,
    });
  },
});
