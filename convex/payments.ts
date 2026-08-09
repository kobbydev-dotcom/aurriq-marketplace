import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const initiateMomoCharge = internalAction({
  args: {
    paymentReference: v.string(),
    amount: v.number(),
    phone: v.optional(v.string()),
    network: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const endpoint = process.env.MOMO_COLLECTION_URL;

    if (!endpoint) {
      await ctx.runMutation((internal as any).payments.applyPaymentWebhook, {
        paymentReference: args.paymentReference,
        status: "pending",
        providerPayload: { note: "MOMO_COLLECTION_URL not configured" },
      });
      return;
    }

    const payload = {
      amount: Number(args.amount.toFixed(2)),
      phone: args.phone,
      network: args.network,
      currency: process.env.MOMO_CURRENCY ?? "GHS",
      reference: args.paymentReference,
      callbackUrl: process.env.MOMO_CALLBACK_URL,
      description: "Aurriq marketplace checkout",
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.MOMO_API_KEY) headers.Authorization = `Bearer ${process.env.MOMO_API_KEY}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let responseBody: unknown = responseText;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      // Keep plain text payload if provider did not return JSON
    }

    if (!response.ok) {
      await ctx.runMutation((internal as any).payments.applyPaymentWebhook, {
        paymentReference: args.paymentReference,
        status: "failed",
        providerPayload: { payload, response: responseBody },
      });
      return;
    }

    await ctx.runMutation((internal as any).payments.applyPaymentWebhook, {
      paymentReference: args.paymentReference,
      status: "pending",
      providerPayload: { payload, response: responseBody },
    });
  },
});

export const applyPaymentWebhook = internalMutation({
  args: {
    paymentReference: v.string(),
    status: v.union(v.literal("success"), v.literal("failed"), v.literal("pending")),
    transactionId: v.optional(v.string()),
    providerPayload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_payment_reference", (q) => q.eq("paymentReference", args.paymentReference))
      .collect();

    if (orders.length === 0) return;

    if (args.status === "pending") {
      await Promise.all(
        orders.map((order) =>
          ctx.db.patch(order._id, {
            status: order.status === "cancelled" ? order.status : "awaiting_payment",
            paymentStatus: "pending",
            paymentProviderTxnId: args.transactionId,
          })
        )
      );
      return;
    }

    if (args.status === "failed") {
      await Promise.all(
        orders.map((order) =>
          ctx.db.patch(order._id, {
            status: "cancelled",
            paymentStatus: "failed",
            paymentProviderTxnId: args.transactionId,
          })
        )
      );
      return;
    }

    for (const order of orders) {
      if (order.paymentStatus === "paid") continue;

      const product = await ctx.db.get(order.productId);
      if (!product || !order.quantity) {
        await ctx.db.patch(order._id, {
          status: "cancelled",
          paymentStatus: "failed",
          paymentProviderTxnId: args.transactionId,
        });
        continue;
      }

      if (product.stockQuantity < order.quantity) {
        await ctx.db.patch(order._id, {
          status: "cancelled",
          paymentStatus: "failed",
          paymentProviderTxnId: args.transactionId,
        });
        continue;
      }

      const revenue = order.totalAmount ?? ((order.priceAtPurchase ?? 0) * order.quantity);
      await ctx.db.patch(order.productId, {
        stockQuantity: product.stockQuantity - order.quantity,
        totalSold: (product.totalSold ?? 0) + order.quantity,
        totalRevenue: (product.totalRevenue ?? 0) + revenue,
      });

      await ctx.db.patch(order._id, {
        status: "pending",
        paymentStatus: "paid",
        paymentProviderTxnId: args.transactionId,
      });

      await ctx.scheduler.runAfter(0, internal.inventory.checkAndSendAlerts, {
        productId: order.productId,
      });
    }
  },
});