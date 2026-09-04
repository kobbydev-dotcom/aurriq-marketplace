import { action, internalAction, internalMutation, mutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
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

export const MARKETPLACE_VENDOR_PLANS = {
  monthly: { label: "Monthly", months: 1, direct: 169, partner: 149 },
  quarterly: { label: "Quarterly", months: 3, direct: 479, partner: 419 },
  biannual: { label: "Biannual", months: 6, direct: 899, partner: 799 },
  annual: { label: "Annual", months: 12, direct: 1590, partner: 1399 },
} as const;

type MarketplacePlanKey = keyof typeof MARKETPLACE_VENDOR_PLANS;

function marketplacePlan(key: string, source: string) {
  const plan = MARKETPLACE_VENDOR_PLANS[key as MarketplacePlanKey];
  if (!plan) return null;
  return { ...plan, amount: source === "doabookpro" ? plan.partner : plan.direct };
}

// Public action: start the separate Aurriq marketplace vendor subscription.
// Paystack returns a hosted checkout URL; no booking subscription is changed.
export const startMarketplaceSubscription = action({
  args: {
    planKey: v.string(),
    source: v.optional(v.union(v.literal("direct"), v.literal("doabookpro"))),
  },
  handler: async (ctx, args) => {
    const user: any = await ctx.runQuery(api.users.current, {});
    if (!user) throw new Error("Please sign in before activating your seller account");

    const source = user.doabookproSlug ? "doabookpro" : (args.source ?? "direct");
    const plan = marketplacePlan(args.planKey, source);
    if (!plan) throw new Error("Invalid marketplace subscription plan");

    const reference = `AURRIQ-VENDOR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await ctx.runMutation(internal.payments.createMarketplaceSubscription, {
      userId: user._id,
      planKey: args.planKey,
      source,
      amount: plan.amount,
      paymentReference: reference,
    });

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Marketplace payments are not configured yet");

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        amount: Math.round(plan.amount * 100),
        email: user.email ?? "vendor@aurriq.com",
        currency: "GHS",
        reference,
        callback_url: `${process.env.APP_URL ?? "https://aurriq-marketplace-live-a04ea8311137.herokuapp.com"}/seller/dashboard?subscription=success&reference=${encodeURIComponent(reference)}`,
        metadata: {
          type: "aurriq_marketplace_vendor_subscription",
          source,
          plan: args.planKey,
        },
      }),
    });
    const payload: any = await response.json().catch(() => ({}));

    if (!response.ok || payload?.status === false || !payload?.data?.authorization_url) {
      await ctx.runMutation(internal.payments.failMarketplaceSubscription, {
        userId: user._id,
        paymentReference: reference,
      });
      throw new Error(payload?.message ?? "Unable to initialize marketplace payment");
    }

    return {
      authorizationUrl: payload.data.authorization_url as string,
      reference,
      amount: plan.amount,
      source,
      plan: plan.label,
    };
  },
});

export const createMarketplaceSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    planKey: v.string(),
    source: v.string(),
    amount: v.number(),
    paymentReference: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      marketplaceSubscriptionStatus: "payment_pending",
      marketplacePlan: args.planKey,
      marketplaceSubscriptionSource: args.source,
      marketplacePaymentReference: args.paymentReference,
    });
  },
});

export const failMarketplaceSubscription = internalMutation({
  args: { userId: v.id("users"), paymentReference: v.string() },
  handler: async (ctx, args) => {
    const user: any = await ctx.db.get(args.userId);
    if (user?.marketplacePaymentReference !== args.paymentReference) return;
    await ctx.db.patch(args.userId, { marketplaceSubscriptionStatus: "payment_failed" });
  },
});

export const applyMarketplaceSubscription = internalMutation({
  args: {
    paymentReference: v.string(),
    status: v.union(v.literal("success"), v.literal("failed")),
    transactionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();
    const user: any = users.find((candidate: any) => candidate.marketplacePaymentReference === args.paymentReference);
    if (!user) return;
    if (args.status === "failed") {
      await ctx.db.patch(user._id, { marketplaceSubscriptionStatus: "payment_failed" });
      return;
    }

    const plan = marketplacePlan(user.marketplacePlan ?? "", user.marketplaceSubscriptionSource ?? "direct");
    if (!plan) return;
    const currentUntil = typeof user.marketplacePaidUntil === "number" && user.marketplacePaidUntil > Date.now()
      ? user.marketplacePaidUntil
      : Date.now();
    const paidUntil = currentUntil + Math.round(plan.months * 30.4375 * 24 * 60 * 60 * 1000);

    await ctx.db.patch(user._id, {
      isSeller: true,
      role: "seller",
      marketplaceSubscriptionStatus: "active",
      marketplacePaidUntil: paidUntil,
    });
  },
});

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

      // Track the purchase for analytics.
      await ctx.runMutation(internal.analytics.recordEvent, {
        subjectType: "product",
        subjectId: String(order.productId),
        kind: "purchase",
        productId: order.productId,
        sellerId: order.sellerId,
      });

      // Send the buyer a receipt via SMS + email.
      await ctx.scheduler.runAfter(0, internal.receipts.sendOrderReceipt, {
        orderId: order._id,
      });
    }
  },
});

// Public return-path verification. Webhooks remain the primary settlement path;
// this closes the gap when Paystack's webhook is delayed or unavailable.
export const verifyMarketplaceSubscription = mutation({
  args: { paymentReference: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Please sign in again to verify your payment");
    const user: any = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.marketplacePaymentReference !== args.paymentReference) {
      throw new Error("This payment does not belong to the signed-in account");
    }

    await ctx.scheduler.runAfter(0, internal.payments.verifyMarketplaceTransaction, {
      userId: user._id,
      paymentReference: args.paymentReference,
    });
    return { status: "verifying" };
  },
});

export const verifyMarketplaceTransaction = internalAction({
  args: { userId: v.id("users"), paymentReference: v.string() },
  handler: async (ctx, args) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return;
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(args.paymentReference)}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    const payload: any = await response.json().catch(() => ({}));
    const status = String(payload?.data?.status ?? "").toLowerCase();
    await ctx.runMutation(internal.payments.applyMarketplaceSubscription, {
      paymentReference: args.paymentReference,
      status: status === "success" ? "success" : "failed",
      transactionId: payload?.data?.id ? String(payload.data.id) : undefined,
    });
  },
});

// Recovery path for a successful Paystack payment whose browser return/login
// flow lost the pending reference. Requires the signed-in account email to
// match Paystack's transaction customer email before activating access.
export const recoverMarketplaceSubscription = action({
  args: { paymentReference: v.string() },
  handler: async (ctx, args) => {
    const user: any = await ctx.runQuery(api.users.current, {});
    if (!user?.email) throw new Error("Please sign in before recovering payment");
    if (!args.paymentReference.startsWith("AURRIQ-VENDOR-")) {
      throw new Error("That is not an Aurriq vendor payment reference");
    }

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Payment verification is not configured");
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(args.paymentReference)}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    const payload: any = await response.json().catch(() => ({}));
    const customerEmail = String(payload?.data?.customer?.email ?? "").toLowerCase();
    const accountEmail = String(user.email).toLowerCase();
    if (customerEmail && customerEmail !== accountEmail) {
      throw new Error("This payment belongs to a different email account");
    }
    if (String(payload?.data?.status ?? "").toLowerCase() !== "success") {
      throw new Error("Paystack has not marked this payment successful yet");
    }

    await ctx.runMutation(internal.payments.applyMarketplaceSubscription, {
      paymentReference: args.paymentReference,
      status: "success",
      transactionId: payload?.data?.id ? String(payload.data.id) : undefined,
    });
    return { recovered: true };
  },
});