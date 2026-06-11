import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const REPORT_REASONS = [
  "Counterfeit / fake product",
  "Misleading product description",
  "Scam / fraud attempt",
  "Inappropriate content",
  "Harassment or threats",
  "Stolen goods",
  "Other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const submitReport = mutation({
  args: {
    targetType: v.union(v.literal("product"), v.literal("seller")),
    targetProductId: v.optional(v.id("products")),
    targetSellerId: v.optional(v.id("users")),
    reason: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Please sign in to submit a report" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    // Prevent self-reporting
    if (args.targetSellerId && args.targetSellerId === user._id) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "You cannot report yourself" });
    }

    // Prevent duplicate reports by same user on same target
    if (args.targetProductId) {
      const existing = await ctx.db
        .query("reports")
        .withIndex("by_target_product", (q) => q.eq("targetProductId", args.targetProductId))
        .filter((q) => q.eq(q.field("reporterId"), user._id))
        .first();
      if (existing) {
        throw new ConvexError({ code: "CONFLICT", message: "You have already reported this product" });
      }
    }

    if (args.targetSellerId) {
      const existing = await ctx.db
        .query("reports")
        .withIndex("by_target_seller", (q) => q.eq("targetSellerId", args.targetSellerId))
        .filter((q) => q.eq(q.field("reporterId"), user._id))
        .first();
      if (existing) {
        throw new ConvexError({ code: "CONFLICT", message: "You have already reported this seller" });
      }
    }

    return await ctx.db.insert("reports", {
      reporterId: user._id,
      targetType: args.targetType,
      targetProductId: args.targetProductId,
      targetSellerId: args.targetSellerId,
      reason: args.reason,
      details: args.details,
      status: "pending",
    });
  },
});

// Admin: list all reports with enriched context
export const listReports = query({
  args: {
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("reviewed"),
      v.literal("resolved"),
      v.literal("dismissed")
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!admin || admin.role !== "seller" || !admin.isVerified) return [];
    // Using isVerified + seller as a proxy for admin access
    // In production you'd have a dedicated admin role

    let reportsQuery;
    if (args.status) {
      reportsQuery = ctx.db
        .query("reports")
        .withIndex("by_status", (q) => q.eq("status", args.status!));
    } else {
      reportsQuery = ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", "pending"));
    }

    const reports = await reportsQuery.order("desc").take(100);

    return await Promise.all(
      reports.map(async (r) => {
        const reporter = await ctx.db.get(r.reporterId);
        const product = r.targetProductId ? await ctx.db.get(r.targetProductId) : null;
        const seller = r.targetSellerId ? await ctx.db.get(r.targetSellerId) : null;
        return {
          ...r,
          reporterName: (reporter as any)?.name ?? "Unknown",
          productName: (product as any)?.name ?? null,
          sellerName: (seller as any)?.name ?? null,
        };
      })
    );
  },
});

export const updateReportStatus = mutation({
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!admin || admin.role !== "seller" || !admin.isVerified) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    await ctx.db.patch(args.reportId, {
      status: args.status,
      adminNote: args.adminNote,
    });
  },
});
