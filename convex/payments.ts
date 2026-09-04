import { internalAction, internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Paystack charge (MoMo / card) — all electronic payments run through Aurriq.
// ---------------------------------------------------------------------------

const NETWORK_TO_PAYSTACK: Record<string, string> = {
  mtn: "MTN",
  telecel: "VOD",
  vodafone: "VOD",
  airteltigo: "ATL",
  airtel: "ATL",
  tigo: "ATL",
};

export const initiatePaystackCharge = internalAction({
  args: {
    paymentReference: v.string(),
    amount: v.number(), // major units (GHS)
    email: v.string(),
    phone: v.optional(v.string()),
    network: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      await ctx.runMutation(internal.payments.applyPaymentWebhook, {
        paymentReference: args.paymentReference,
        status: "pending",
        providerPayload: { note: "PAYSTACK_SECRET_KEY not configured" },
      });
      return;
    }

    const amountMinor = Math.round(args.amount * 100); // Paystack expects pesewas
    const isMomo = !!(args.phone && args.network);

    const body: Record<string, unknown> = isMomo
      ? {
          amount: amountMinor,
          email: args.email,
          currency: "GHS",
          reference: args.paymentReference,
          mobile_money: {
            phone: args.phone,
            provider: NETWORK_TO_PAYSTACK[(args.network ?? "").toLowerCase()] ?? "MTN",
          },
        }
      : {
          amount: amountMinor,
          email: args.email,
          currency: "GHS",
          reference: args.paymentReference,
        };

    const endpoint = isMomo
      ? "https://api.paystack.co/charge"
      : "https://api.paystack.co/transaction/initialize";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
    });

    const json: any = await response.json().catch(() => ({}));

    if (!response.ok || json?.status === false) {
      await ctx.runMutation(internal.payments.applyPaymentWebhook, {
        paymentReference: args.paymentReference,
        status: "failed",
        providerPayload: { request: body, response: json },
      });
      return;
    }

    // Card flows return an authorization_url the buyer must be redirected to.
    const authorizationUrl = json?.data?.authorization_url as string | undefined;
    await ctx.runMutation(internal.payments.applyPaymentWebhook, {
      paymentReference: args.paymentReference,
      status: "pending",
      providerPayload: { request: { ...body, email: "***" }, response: json },
    });
    if (authorizationUrl) {
      await ctx.runMutation(internal.payments.setPaymentAuthorizationUrl, {
        paymentReference: args.paymentReference,
        authorizationUrl,
      });
    }
  },
});

// Store the Paystack authorization URL on the order(s) so the client can redirect.
export const setPaymentAuthorizationUrl = internalMutation({
  args: { paymentReference: v.string(), authorizationUrl: v.string() },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_payment_reference", (q) => q.eq("paymentReference", args.paymentReference))
      .collect();
    await Promise.all(
      orders.map((order) => ctx.db.patch(order._id, { authorizationUrl: args.authorizationUrl }))
    );
  },
});

// Public mutation: buyer taps "I've paid" → re-check status with Paystack.
export const verifyPaymentByReference = mutation({
  args: { paymentReference: v.string() },
  handler: async (ctx, args): Promise<{ status: string; paid: boolean }> => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_payment_reference", (q) => q.eq("paymentReference", args.paymentReference))
      .collect();
    if (orders.length === 0) return { status: "not_found", paid: false };
    if (orders.every((o) => o.paymentStatus === "paid")) return { status: "success", paid: true };

    await ctx.scheduler.runAfter(0, internal.payments.verifyPaystackTransaction, {
      paymentReference: args.paymentReference,
    });
    return { status: "verifying", paid: false };
  },
});

export const verifyPaystackTransaction = internalAction({
  args: { paymentReference: v.string() },
  handler: async (ctx, args) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return;
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(args.paymentReference)}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    const json: any = await res.json().catch(() => ({}));
    const status = String(json?.data?.status ?? "").toLowerCase();
    const normalized = status === "success" ? "success" : status === "failed" ? "failed" : "pending";
    await ctx.runMutation(internal.payments.applyPaymentWebhook, {
      paymentReference: args.paymentReference,
      status: normalized,
      transactionId: json?.data?.id ? String(json.data.id) : undefined,
      providerPayload: json,
    });
  },
});

// ---------------------------------------------------------------------------
// Shared settlement logic — called by webhooks / verify once payment resolves.
// ---------------------------------------------------------------------------

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

      // Partial-payment products: this online charge settles the deposit only;
      // the balance is collected on delivery.
      const isPartial =
        order.depositAmount != null && order.balanceAmount != null && order.balanceAmount > 0;

      await ctx.db.patch(order._id, {
        status: "pending",
        paymentStatus: "paid",
        depositPaid: true,
        balancePaid: isPartial ? false : true,
        paymentProviderTxnId: args.transactionId,
      });

      await ctx.scheduler.runAfter(0, internal.inventory.checkAndSendAlerts, {
        productId: order.productId,
      });

      // Send the buyer a receipt via SMS + email.
      await ctx.scheduler.runAfter(0, internal.receipts.sendOrderReceipt, {
        orderId: order._id,
      });
    }
  },
});