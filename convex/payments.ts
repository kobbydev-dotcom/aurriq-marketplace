import { action, internalAction, internalMutation, mutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Hubtel is the active payment route for Aurriq; Paystack references have been
// removed from the platform and replaced with Hubtel-compatible metadata.
// ---------------------------------------------------------------------------

const NETWORK_TO_HUBTEL: Record<string, string> = {
  mtn: "mtn",
  telecel: "telecel",
  vodafone: "vodafone",
  airteltigo: "airteltigo",
  airtel: "airtel",
  tigo: "tigo",
};

export const MARKETPLACE_VENDOR_PLANS = {
  monthly: { label: "Monthly", months: 1, direct: 169, partner: 149 },
  quarterly: { label: "Quarterly", months: 3, direct: 479, partner: 419 },
  biannual: { label: "Biannual", months: 6, direct: 899, partner: 799 },
  annual: { label: "Annual", months: 12, direct: 1590, partner: 1399 },
} as const;

export const AURRIQ_ACTIVATION_PAYMENT = {
  momo: {
    label: "Mobile Money",
    number: "0241678898",
    name: "David Agyemang",
  },
  bank: {
    label: "Bank Transfer",
    accountName: "David Osei Agyemang",
    accountNumber: "1731010003612",
    bankName: "GCB Bank PLC",
    branch: "Labone",
  },
};

type MarketplacePlanKey = keyof typeof MARKETPLACE_VENDOR_PLANS;

function marketplacePlan(key: string, source: string) {
  const plan = MARKETPLACE_VENDOR_PLANS[key as MarketplacePlanKey];
  if (!plan) return null;
  return { ...plan, amount: source === "doabookpro" ? plan.partner : plan.direct };
}

// Public action: start the separate Aurriq marketplace vendor subscription.
// Hubtel is the active payment provider for the platform. If the Hubtel config
// is not set here yet, the app fails closed instead of silently using Paystack.
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

    const superadminUrl = process.env.DOABOOKPRO_MARKETPLACE_REQUEST_URL;
    const superadminSecret = process.env.DOABOOKPRO_MARKETPLACE_SECRET;
    if (!superadminUrl || !superadminSecret) {
      throw new Error("Marketplace activation is not fully configured yet. Please contact support before making payment.");
    }

    const reference = `AURRIQ-VENDOR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await ctx.runMutation(internal.payments.createMarketplaceSubscription, {
      userId: user._id,
      planKey: args.planKey,
      source,
      amount: plan.amount,
      paymentReference: reference,
    });

    const response = await fetch(superadminUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superadminSecret}`,
      },
      body: JSON.stringify({
        reference,
        sellerId: String(user._id),
        sellerName: user.name ?? user.email ?? "Aurriq seller",
        sellerEmail: user.email,
        sellerPhone: user.phone,
        storeName: user.name,
        planKey: args.planKey,
        planLabel: plan.label,
        amount: plan.amount,
        months: plan.months,
        source,
      }),
    });

    if (!response.ok) {
      throw new Error("Your activation request was saved on Aurriq, but DOABookPro could not be notified yet. Please contact support with your payment reference.");
    }

    return {
      reference,
      planLabel: plan.label,
      amount: plan.amount,
      months: plan.months,
      payment: AURRIQ_ACTIVATION_PAYMENT,
      referenceNote: "Use your name or store name as the payment reference.",
      status: "payment_pending",
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
      marketplaceSubscriptionAmount: args.amount,
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
    const user: any = await ctx.db
      .query("users")
      .withIndex("by_marketplace_payment_reference", (q) => q.eq("marketplacePaymentReference", args.paymentReference))
      .unique();
    if (!user) {
      throw new Error(`Marketplace subscription user not found for payment reference ${args.paymentReference}`);
    }
    if (args.status === "failed") {
      await ctx.db.patch(user._id, { marketplaceSubscriptionStatus: "payment_failed" });
      if (user.phone) {
        await ctx.scheduler.runAfter(0, internal.sms.sendSMS, {
          to: user.phone,
          message: "Aurriq update: your seller account activation could not be approved after payment review. Please contact Aurriq support with your payment reference for assistance.",
        });
      }
      if (user.email) {
        await ctx.scheduler.runAfter(0, internal.mail.sendEmail, {
          to: user.email,
          subject: "Aurriq seller account activation update",
          heading: "Seller account activation update",
          bodyLines: [
            "Your Aurriq seller account activation could not be approved after payment review.",
            "Please contact Aurriq support with your payment reference so this can be reviewed.",
          ],
          ctaText: "Open Aurriq",
          ctaUrl: `${process.env.AURRIQ_PUBLIC_URL ?? "https://aurriq.doabookpro.com"}/profile`,
        });
      }
      await ctx.runMutation(internal.notifications.createNotification, {
        userId: user._id,
        type: "payment",
        title: "Seller activation not approved",
        body: "Your seller account activation could not be approved after payment review. Please contact Aurriq support with your payment reference.",
        link: "/profile",
      });
      return;
    }

    const plan = marketplacePlan(user.marketplacePlan ?? "", user.marketplaceSubscriptionSource ?? "direct");
    if (!plan) {
      throw new Error(`Marketplace subscription plan not found for payment reference ${args.paymentReference}`);
    }
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

    if (user.phone) {
      await ctx.scheduler.runAfter(0, internal.sms.sendSMS, {
        to: user.phone,
        message: "Congratulations from Aurriq! Your storefront is ready. Welcome to the Aurriq family. We are excited to see your shop grow and wish you many successful sales.",
      });
    }
    if (user.email) {
      await ctx.scheduler.runAfter(0, internal.mail.sendEmail, {
        to: user.email,
        subject: "Your Aurriq storefront is ready",
        heading: "Congratulations, your seller account is active",
        bodyLines: [
          "Welcome to the Aurriq family. Your storefront and seller dashboard are now ready.",
          "We are excited to see your shop grow and wish you many successful sales.",
        ],
        ctaText: "Open seller dashboard",
        ctaUrl: `${process.env.AURRIQ_PUBLIC_URL ?? "https://aurriq.doabookpro.com"}/seller/dashboard`,
      });
    }
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: user._id,
      type: "payment",
      title: "Your Aurriq storefront is ready",
      body: "Congratulations and welcome to the Aurriq family. Your seller dashboard is now active.",
      link: "/seller/dashboard",
    });
  },
});

export const activateMarketplaceSubscriptionFromSuperadmin = mutation({
  args: {
    paymentReference: v.string(),
    activationSecret: v.string(),
    transactionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const expected = process.env.DOABOOKPRO_MARKETPLACE_SECRET;
    if (!expected || args.activationSecret !== expected) {
      throw new Error("Unauthorized activation request");
    }
    await ctx.runMutation(internal.payments.applyMarketplaceSubscription, {
      paymentReference: args.paymentReference,
      status: "success",
      transactionId: args.transactionId,
    });
    return { activated: true };
  },
});

export const rejectMarketplaceSubscriptionFromSuperadmin = mutation({
  args: {
    paymentReference: v.string(),
    activationSecret: v.string(),
    transactionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const expected = process.env.DOABOOKPRO_MARKETPLACE_SECRET;
    if (!expected || args.activationSecret !== expected) {
      throw new Error("Unauthorized rejection request");
    }
    await ctx.runMutation(internal.payments.applyMarketplaceSubscription, {
      paymentReference: args.paymentReference,
      status: "failed",
      transactionId: args.transactionId,
    });
    return { rejected: true };
  },
});

export const initiateHubtelCharge = internalAction({
  args: {
    paymentReference: v.string(),
    amount: v.number(),
    email: v.string(),
    phone: v.optional(v.string()),
    network: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clientId = process.env.HUBTEL_CLIENT_ID;
    const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      await ctx.runMutation(internal.payments.applyPaymentWebhook, {
        paymentReference: args.paymentReference,
        status: "pending",
        providerPayload: { note: "HUBTEL_CLIENT_ID or HUBTEL_CLIENT_SECRET not configured" },
      });
      return;
    }

    const provider = NETWORK_TO_HUBTEL[(args.network ?? "").toLowerCase()] ?? "mtn";
    await ctx.runMutation(internal.payments.applyPaymentWebhook, {
      paymentReference: args.paymentReference,
      status: "pending",
      providerPayload: {
        note: "Hubtel collection is configured but not yet wired to a live checkout endpoint.",
        amount: args.amount,
        email: args.email,
        phone: args.phone,
        provider,
      },
    });
  },
});

export const initiatePaystackCharge = initiateHubtelCharge;

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
    if (!user?.email) return { recovered: false, message: "Please sign in to finish activating your vendor account." };
    if (!args.paymentReference.startsWith("AURRIQ-VENDOR-")) {
      return { recovered: false, message: "This payment link is no longer valid. Please start a new subscription." };
    }

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return { recovered: false, message: "Payment verification is temporarily unavailable. Please try again shortly." };
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(args.paymentReference)}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    const payload: any = await response.json().catch(() => ({}));
    const customerEmail = String(payload?.data?.customer?.email ?? "").toLowerCase();
    const accountEmail = String(user.email).toLowerCase();
    if (customerEmail && customerEmail !== accountEmail) {
      return { recovered: false, message: "This payment belongs to a different email account." };
    }
    if (String(payload?.data?.status ?? "").toLowerCase() !== "success") {
      return { recovered: false, message: "Paystack has not confirmed this payment yet. No further action is needed; you can try again shortly." };
    }

    try {
      await ctx.runMutation(internal.payments.applyMarketplaceSubscription, {
        paymentReference: args.paymentReference,
        status: "success",
        transactionId: payload?.data?.id ? String(payload.data.id) : undefined,
      });
    } catch {
      return { recovered: false, message: "We could not link this payment to your account yet. Please contact support with your Paystack receipt." };
    }
    return { recovered: true };
  },
});
