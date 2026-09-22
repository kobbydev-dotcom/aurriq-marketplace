import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

async function resolveMediaUrl(ctx: any, value: string | undefined | null): Promise<string> {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  try {
    return (await ctx.storage.getUrl(value as any)) ?? value;
  } catch {
    return value;
  }
}

async function enrichOrderProduct(ctx: any, product: any) {
  if (!product) return product;
  const images = await Promise.all((product.images ?? []).map((media: string) => resolveMediaUrl(ctx, media)));
  const videos = await Promise.all((product.videos ?? []).map((media: string) => resolveMediaUrl(ctx, media)));
  return {
    ...product,
    images,
    videos,
    imageUrl: product.imageUrl ? await resolveMediaUrl(ctx, product.imageUrl) : (images[0] ?? ""),
  };
}

function formatGhs(n: number) {
  return `GHS ${Number(n || 0).toFixed(2)}`;
}

function orderReference(order: any) {
  return String(order.paymentReference ?? order._id);
}

function deliveryLabel(value?: string) {
  const labels: Record<string, string> = {
    within_1_hour: "within 1 hour",
    same_day: "same day",
    one_day: "1 day",
    two_days: "2 days",
    accra_same_day: "same day in Accra",
    outside_accra_2_3_days: "2-3 days outside Accra",
    arranged_with_buyer: "as arranged with the seller",
  };
  return value ? labels[value] ?? value : undefined;
}

async function notifyBuyerBySmsAndEmail(ctx: any, order: any, product: any, buyer: any, title: string, message: string) {
  const phone = order.buyerPhone ?? buyer?.phone;
  const email = order.receiptEmail ?? buyer?.email;
  const buyerName = buyer?.name ?? "Customer";
  if (phone) {
    await ctx.scheduler.runAfter(0, internal.sms.sendSMS, {
      to: phone,
      message,
    });
  }
  if (email) {
    await ctx.scheduler.runAfter(0, internal.mail.sendEmail, {
      to: email,
      subject: title,
      heading: title,
      bodyLines: [
        `Hi ${buyerName},`,
        message,
        `Reference: ${orderReference(order)}`,
        `Item: ${product?.name ?? "Your order"}`,
      ],
      ctaText: "View Order",
      ctaUrl: "https://aurriq.doabookpro.com/orders",
    });
  }
}

async function notifyBuyerOrderReceived(ctx: any, order: any, product: any, buyer: any) {
  const delivery = deliveryLabel((product as any)?.deliveryPeriod);
  const trackingUrl = `https://aurriq.doabookpro.com/orders?order=${order._id}`;
  const message = [
    `AURRIQ: Your order for ${product?.name ?? "your item"} has been received.`,
    `Ref ${orderReference(order)}.`,
    "Payment will be confirmed shortly and you will be notified once payment is received and the order is dispatched.",
    delivery ? `Expected delivery/pickup: ${delivery}.` : "",
    `Track here: ${trackingUrl}`,
  ].filter(Boolean).join(" ");

  await notifyBuyerBySmsAndEmail(ctx, order, product, buyer, "Order received", message);
  await ctx.runMutation(internal.notifications.createNotification, {
    userId: order.buyerId,
    type: "order_status",
    title: "Order received",
    body: message,
    link: `/orders?order=${order._id}`,
  });
}

function statusMessage(status: string, productName: string, reference: string) {
  const item = productName || "your order";
  if (status === "confirmed") return `AURRIQ: ${item} is confirmed. Ref ${reference}. The seller is preparing it for delivery or pickup.`;
  if (status === "shipped") return `AURRIQ: ${item} has been shipped. Ref ${reference}. Please keep your phone available for delivery updates.`;
  if (status === "delivered") return `AURRIQ: ${item} has been marked delivered. Ref ${reference}. Thank you for shopping with Aurriq.`;
  if (status === "cancelled") return `AURRIQ: ${item} has been cancelled. Ref ${reference}. Contact Aurriq support if you need help.`;
  return `AURRIQ: ${item} is now ${status}. Ref ${reference}.`;
}

function assertSellerDashboardAccess(user: any) {
  if (user.marketplaceSubscriptionStatus === "locked" || (typeof user.marketplacePaidUntil === "number" && user.marketplacePaidUntil < Date.now())) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Your seller dashboard is locked because your Aurriq subscription has expired. Renew your plan to continue managing orders." });
  }
}

export const placeOrder = mutation({
  args: {
    buyerPhone: v.optional(v.string()),
    buyerNote: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    paymentNetwork: v.optional(v.string()),
    paymentAccount: v.optional(v.string()),
    receiptEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ orderIds: string[]; total: number; paymentReference?: string; paymentPending?: boolean; amountDueNow?: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Please sign in to place an order" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (cartItems.length === 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Your cart is empty" });
    }

    // Fetch products and determine each item's effective payment mode.
    const productMap = new Map<string, any>();
    for (const item of cartItems) {
      const product = await ctx.db.get(item.productId);
      if (product) productMap.set(item.productId, product);
    }

    const effectiveMode = (product: any): string => {
      const mode = product?.paymentOptions?.mode;
      return mode === "momo" || mode === "cod" || mode === "negotiable" || mode === "partial" ? mode : "momo";
    };

    const anyOnline = cartItems.some((item) => {
      const product = productMap.get(item.productId);
      const mode = effectiveMode(product);
      return mode === "momo" || mode === "partial";
    });

    const requestedReceiptMode = args.paymentMethod === "mobile_money" ? "momo" : args.paymentMethod;
    for (const item of cartItems) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      const mode = effectiveMode(product);
      const acceptedModes = product.paymentOptions?.acceptedModes ?? [mode === "partial" ? "momo" : mode];
      if (requestedReceiptMode && !acceptedModes.includes(requestedReceiptMode) && (mode === "momo" || mode === "partial")) {
        throw new ConvexError({ code: "BAD_REQUEST", message: `"${product.name}" does not accept that payment method` });
      }
    }

    const isManualReceiptPayment = anyOnline && ["mobile_money", "bank_transfer"].includes(args.paymentMethod ?? "");
    const paymentReference = isManualReceiptPayment ? `AURRIQ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : undefined;

    if (isManualReceiptPayment && !args.buyerPhone) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Provide your SMS receipt phone number so the seller can confirm and update you" });
    }

    const orderIds: string[] = [];
    let total = 0;
    let amountDueNow = 0;

    for (const item of cartItems) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      if (!product.isActive) {
        throw new ConvexError({ code: "BAD_REQUEST", message: `"${product.name}" is no longer available` });
      }
      if (product.stockQuantity < item.quantity) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: `Only ${product.stockQuantity} unit(s) of "${product.name}" are available`,
        });
      }

      const retailPrice = product.promoPrice ?? product.originalPrice;
      // Wholesale: if the buyer's quantity meets the seller's wholesale minimum,
      // charge the wholesale unit price.
      const priceAtPurchase =
        (product as any).wholesalePrice != null &&
        (product as any).wholesaleMinQty != null &&
        item.quantity >= (product as any).wholesaleMinQty
          ? (product as any).wholesalePrice
          : retailPrice;
      const totalAmount = (priceAtPurchase ?? 0) * item.quantity;
      total += totalAmount;

      const mode = effectiveMode(product);
      const itemOnline = isManualReceiptPayment && (mode === "momo" || mode === "partial");
      const seller: any = await ctx.db.get(product.sellerId);
      const sellerPaymentModes = seller?.paymentReceiptModes ?? {};
      const acceptedModes = product.paymentOptions?.acceptedModes ?? [mode === "momo" || mode === "partial" ? "momo" : mode];
      const sellerPaymentInstructions = {
        acceptedModes,
        momo: acceptedModes.includes("momo") && sellerPaymentModes.momo?.enabled ? sellerPaymentModes.momo : undefined,
        bank: acceptedModes.includes("bank_transfer") && sellerPaymentModes.bank?.enabled ? sellerPaymentModes.bank : undefined,
      };

      // Deposit / balance split for partial products.
      let depositAmount: number | undefined;
      let balanceAmount: number | undefined;
      if (mode === "partial") {
        const pct = Math.min(100, Math.max(1, product.paymentOptions?.percent ?? 50));
        depositAmount = Math.round(totalAmount * (pct / 100) * 100) / 100;
        balanceAmount = Math.round((totalAmount - depositAmount) * 100) / 100;
      }

      if (itemOnline) {
        amountDueNow += mode === "partial" ? (depositAmount ?? totalAmount) : totalAmount;
      }

      const orderId = await ctx.db.insert("orders", {
        userId: user._id,
        buyerId: user._id,
        sellerId: product.sellerId,
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase,
        totalAmount,
        status: itemOnline ? "awaiting_payment" : "pending",
        buyerPhone: args.buyerPhone,
        buyerNote: args.buyerNote,
        paymentMethod: mode === "cod" ? "cash_on_delivery" : mode === "negotiable" ? "negotiable" : args.paymentMethod,
        paymentNetwork: undefined,
        paymentAccount: undefined,
        paymentReference: itemOnline ? paymentReference : undefined,
        paymentStatus: itemOnline ? "initiated" : "not_required",
        sellerPaymentInstructions: itemOnline ? sellerPaymentInstructions : undefined,
        receiptEmail: args.receiptEmail ?? (user as any).email,
        depositAmount,
        balanceAmount,
        depositPaid: mode === "partial" ? false : undefined,
        balancePaid: mode === "partial" ? false : undefined,
      });
      orderIds.push(orderId);
      const insertedOrder = await ctx.db.get(orderId);
      if (insertedOrder) {
        await notifyBuyerOrderReceived(ctx, insertedOrder, product, user);
      }

      // Notify the seller instantly (SMS + optional email + in-app) about the new order.
      await ctx.scheduler.runAfter(0, (internal as any).receipts.notifySellerOfOrder, {
        orderId,
      });

      if (!itemOnline) {
        // Non-gateway methods settle stock immediately.
        const newStock = product.stockQuantity - item.quantity;
        await ctx.db.patch(item.productId, {
          stockQuantity: newStock,
          totalSold: product.totalSold + item.quantity,
          totalRevenue: product.totalRevenue + totalAmount,
        });

        await ctx.scheduler.runAfter(0, internal.inventory.checkAndSendAlerts, {
          productId: item.productId,
        });

        // COD / negotiable orders get a receipt right away (nothing paid yet).
        await ctx.scheduler.runAfter(0, (internal as any).receipts.sendOrderReceipt, {
          orderId,
        });
      }
    }

    // Clear cart
    await Promise.all(cartItems.map((item) => ctx.db.delete(item._id)));

    return { orderIds, total, paymentReference, paymentPending: isManualReceiptPayment, amountDueNow };
  },
});

export const getMyOrders = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_buyer", (q) => q.eq("buyerId", user._id))
      .order("desc")
      .take(50);

    return await Promise.all(
      orders.map(async (order) => {
        const product = await enrichOrderProduct(ctx, await ctx.db.get(order.productId));
        const seller = await ctx.db.get(order.sellerId);
        return { ...order, product, sellerName: seller?.name ?? "Unknown Seller" };
      })
    );
  },
});

export const getSellerOrders = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_seller", (q) => q.eq("sellerId", user._id))
      .order("desc")
      .take(100);

    return await Promise.all(
      orders.map(async (order) => {
        const product = await enrichOrderProduct(ctx, await ctx.db.get(order.productId));
        const buyer = await ctx.db.get(order.buyerId);
        return { ...order, product, buyerName: buyer?.name ?? "Unknown Buyer" };
      })
    );
  },
});

export const updateOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("confirmed"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND", message: "Order not found" });
    if (order.sellerId !== user._id) throw new ConvexError({ code: "FORBIDDEN", message: "Not your order" });
    assertSellerDashboardAccess(user);

    await ctx.db.patch(args.orderId, { status: args.status });

    // Audit trail for the seller.
    const product = await ctx.db.get(order.productId);
    await ctx.runMutation(internal.notifications.logActivity, {
      userId: user._id,
      action: `Order ${order.paymentReference ?? args.orderId} marked ${args.status}`,
      meta: { orderId: args.orderId, status: args.status },
    });

    // Notify the buyer of the status change.
    const buyer = await ctx.db.get(order.buyerId);
    const title = `Order ${args.status.replace(/_/g, " ")}`;
    const message = statusMessage(args.status, product?.name ?? "Your order", orderReference(order));
    await notifyBuyerBySmsAndEmail(ctx, order, product, buyer, title, message);
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: order.buyerId,
      type: "order_status",
      title,
      body: message,
      link: "/orders",
    });
  },
});

export const markPaymentReceived = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND", message: "Order not found" });
    if (order.sellerId !== user._id) throw new ConvexError({ code: "FORBIDDEN", message: "Not your order" });
    assertSellerDashboardAccess(user);
    if (order.paymentStatus === "paid") throw new ConvexError({ code: "BAD_REQUEST", message: "Payment already recorded" });

    const product = await ctx.db.get(order.productId);
    if (!product) throw new ConvexError({ code: "NOT_FOUND", message: "Product not found" });
    const quantity = order.quantity ?? 1;
    if (product.stockQuantity < quantity) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Not enough stock remains to confirm this order" });
    }

    const revenue = order.totalAmount ?? ((order.priceAtPurchase ?? 0) * quantity);
    await ctx.db.patch(order.productId, {
      stockQuantity: product.stockQuantity - quantity,
      totalSold: (product.totalSold ?? 0) + quantity,
      totalRevenue: (product.totalRevenue ?? 0) + revenue,
    });

    await ctx.db.patch(args.orderId, {
      status: "confirmed",
      paymentStatus: "paid",
      depositPaid: order.depositAmount != null ? true : order.depositPaid,
      balancePaid: order.balanceAmount != null ? true : order.balancePaid,
    });

    await ctx.scheduler.runAfter(0, internal.inventory.checkAndSendAlerts, {
      productId: order.productId,
    });
    await ctx.runMutation(internal.analytics.recordEvent, {
      subjectType: "product",
      subjectId: String(order.productId),
      kind: "purchase",
      productId: order.productId,
      sellerId: order.sellerId,
    });
    await ctx.scheduler.runAfter(0, (internal as any).receipts.sendOrderReceipt, {
      orderId: args.orderId,
    });
    const buyer = await ctx.db.get(order.buyerId);
    const paymentMessage = `AURRIQ: Payment received for ${product.name ?? "your order"} (${formatGhs(revenue)}). Ref ${orderReference(order)}. Your item is being prepared for delivery or pickup.`;
    await notifyBuyerBySmsAndEmail(ctx, order, product, buyer, "Payment received", paymentMessage);
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: order.buyerId,
      type: "payment",
      title: "Payment received",
      body: paymentMessage,
      link: "/orders",
    });
    await ctx.runMutation(internal.notifications.logActivity, {
      userId: user._id,
      action: `Payment received for ${product.name ?? "order"} — GHS ${revenue.toFixed(2)}`,
      meta: { orderId: args.orderId, productId: order.productId, total: revenue },
    });
  },
});

// Seller marks a deposit order's remaining balance as collected on delivery.
export const markBalanceCollected = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND", message: "Order not found" });
    if (order.sellerId !== user._id) throw new ConvexError({ code: "FORBIDDEN", message: "Not your order" });
    assertSellerDashboardAccess(user);
    if (order.balancePaid) throw new ConvexError({ code: "BAD_REQUEST", message: "Balance already settled" });

    await ctx.db.patch(args.orderId, {
      balancePaid: true,
      status: "delivered",
    });

    const product = await ctx.db.get(order.productId);
    const buyer = await ctx.db.get(order.buyerId);
    await notifyBuyerBySmsAndEmail(
      ctx,
      order,
      product,
      buyer,
      "Order fully paid",
      `AURRIQ: Balance collected for ${product?.name ?? "your order"}. Ref ${orderReference(order)}. Your order is now fully settled. Thank you for shopping with Aurriq.`
    );

    // Audit trail for the seller.
    await ctx.runMutation(internal.notifications.logActivity, {
      userId: user._id,
      action: `Balance collected (GHS ${(order.balanceAmount ?? 0).toFixed(2)}) for ${product?.name ?? "order"}`,
      meta: { orderId: args.orderId, balance: order.balanceAmount },
    });

    // Notify the buyer the order is fully settled.
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: order.buyerId,
      type: "payment",
      title: "Order fully paid",
      body: `Your balance for ${product?.name ?? "your order"} was collected on delivery. Enjoy!`,
      link: "/orders",
    });
  },
});

export const resendRecentBuyerOrderUpdates = mutation({
  args: { hours: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    assertSellerDashboardAccess(user);

    const since = Date.now() - Math.max(1, Math.min(args.hours ?? 72, 720)) * 60 * 60 * 1000;
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_seller", (q) => q.eq("sellerId", user._id))
      .collect();

    let sent = 0;
    for (const order of orders.filter((order) => order._creationTime >= since)) {
      const product = await ctx.db.get(order.productId);
      const buyer = await ctx.db.get(order.buyerId);
      if (!(order.buyerPhone ?? buyer?.phone) && !(order.receiptEmail ?? buyer?.email)) continue;

      const reference = orderReference(order);
      const productName = product?.name ?? "your order";
      const title = order.paymentStatus === "paid" ? "Payment received" : `Order ${String(order.status).replace(/_/g, " ")}`;
      const message = order.paymentStatus === "paid"
        ? `AURRIQ: Payment received for ${productName}. Ref ${reference}. Current status: ${String(order.status).replace(/_/g, " ")}.`
        : statusMessage(String(order.status), productName, reference);
      await notifyBuyerBySmsAndEmail(ctx, order, product, buyer, title, message);
      sent++;
    }

    return { sent };
  },
});
