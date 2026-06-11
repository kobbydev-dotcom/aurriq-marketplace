import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel.d.ts";

/**
 * Called after an order is placed to decrement stock and update revenue.
 * Also triggers SMS alerts if thresholds are crossed.
 */
export const decrementStock = internalMutation({
  args: {
    productId: v.id("products"),
    quantity: v.number(),
    revenue: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const product = await ctx.db.get(args.productId);
    if (!product) return;

    const newStock = Math.max(0, product.stockQuantity - args.quantity);
    const newTotalSold = product.totalSold + args.quantity;
    const newTotalRevenue = product.totalRevenue + args.revenue;

    await ctx.db.patch(args.productId, {
      stockQuantity: newStock,
      totalSold: newTotalSold,
      totalRevenue: newTotalRevenue,
    });

    // Fetch seller to get their phone number for SMS
    const seller = await ctx.db.get(product.sellerId);
    const sellerPhone = seller?.phone;

    // Out of stock alert — only send once per out-of-stock event
    if (newStock === 0 && !product.outOfStockAlertSent && sellerPhone) {
      await ctx.db.patch(args.productId, { outOfStockAlertSent: true });
      await ctx.scheduler.runAfter(0, internal.sms.sendSMS, {
        to: sellerPhone,
        message: `AURRIQ STOCK ALERT: "${product.name}" is now OUT OF STOCK (0 units remaining). Update your listing to avoid missing sales.`,
      });
      return;
    }

    // Low stock alert — only send once per low-stock event
    if (
      newStock > 0 &&
      newStock <= product.lowStockThreshold &&
      !product.lowStockAlertSent &&
      sellerPhone
    ) {
      await ctx.db.patch(args.productId, { lowStockAlertSent: true });
      await ctx.scheduler.runAfter(0, internal.sms.sendSMS, {
        to: sellerPhone,
        message: `AURRIQ STOCK ALERT: "${product.name}" is running low — ${newStock} unit${newStock !== 1 ? "s" : ""} remaining (your alert is set at ${product.lowStockThreshold}). Restock soon!`,
      });
    }
  },
});

/**
 * Check stock levels and send SMS alerts after an order decrements stock.
 * Called from orders.ts scheduler after order placement.
 */
export const checkAndSendAlerts = internalMutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args): Promise<void> => {
    const product = await ctx.db.get(args.productId);
    if (!product) return;

    const seller = await ctx.db.get(product.sellerId);
    const sellerPhone = seller?.phone;
    if (!sellerPhone) return;

    if (product.stockQuantity === 0 && !product.outOfStockAlertSent) {
      await ctx.db.patch(args.productId, { outOfStockAlertSent: true });
      await ctx.scheduler.runAfter(0, internal.sms.sendSMS, {
        to: sellerPhone,
        message: `AURRIQ STOCK ALERT: "${product.name}" is now OUT OF STOCK (0 units remaining). Update your listing to avoid missing sales.`,
      });
      return;
    }

    if (
      product.stockQuantity > 0 &&
      product.stockQuantity <= product.lowStockThreshold &&
      !product.lowStockAlertSent
    ) {
      await ctx.db.patch(args.productId, { lowStockAlertSent: true });
      await ctx.scheduler.runAfter(0, internal.sms.sendSMS, {
        to: sellerPhone,
        message: `AURRIQ STOCK ALERT: "${product.name}" is running low — ${product.stockQuantity} unit${product.stockQuantity !== 1 ? "s" : ""} remaining (your alert is set at ${product.lowStockThreshold}). Restock soon!`,
      });
    }
  },
});

/**
 * Manually restock a product from the seller dashboard.
 * Resets alert flags so new alerts fire when stock drops again.
 */
export const restockProduct = mutation({
  args: {
    productId: v.id("products"),
    addQuantity: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const product = await ctx.db.get(args.productId);
    if (!product) throw new ConvexError({ code: "NOT_FOUND", message: "Product not found" });
    if (product.sellerId !== user._id) throw new ConvexError({ code: "FORBIDDEN", message: "Not your product" });
    if (args.addQuantity <= 0) throw new ConvexError({ code: "BAD_REQUEST", message: "Add quantity must be positive" });

    const newStock = product.stockQuantity + args.addQuantity;

    await ctx.db.patch(args.productId, {
      stockQuantity: newStock,
      // Reset alert flags so they fire again when stock drops
      lowStockAlertSent: newStock > product.lowStockThreshold ? false : product.lowStockAlertSent,
      outOfStockAlertSent: false,
    });
  },
});

/**
 * Get per-product revenue and inventory breakdown for the seller dashboard.
 */
export const getInventoryReport = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    const products = await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("sellerId", user._id))
      .order("desc")
      .collect();

    return products.map((p) => ({
      _id: p._id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      images: p.images,
      originalPrice: p.originalPrice,
      promoPrice: p.promoPrice,
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold,
      totalSold: p.totalSold,
      totalRevenue: p.totalRevenue,
      isActive: p.isActive,
      stockStatus:
        p.stockQuantity === 0
          ? ("out" as const)
          : p.stockQuantity <= p.lowStockThreshold
            ? ("low" as const)
            : ("ok" as const),
    }));
  },
});
