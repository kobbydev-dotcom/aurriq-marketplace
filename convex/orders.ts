import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

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

    const isOnlineCheckout = anyOnline && args.paymentMethod === "mobile_money";
    const paymentReference = isOnlineCheckout ? `AURRIQ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : undefined;

    if (isOnlineCheckout && !(args.paymentAccount || args.buyerPhone)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Provide a mobile money number to complete checkout" });
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

      const priceAtPurchase = product.promoPrice ?? product.originalPrice;
      const totalAmount = (priceAtPurchase ?? 0) * item.quantity;
      total += totalAmount;

      const mode = effectiveMode(product);
      const itemOnline = isOnlineCheckout && (mode === "momo" || mode === "partial");

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
        paymentNetwork: itemOnline ? args.paymentNetwork : undefined,
        paymentAccount: itemOnline ? args.paymentAccount : undefined,
        paymentReference: itemOnline ? paymentReference : undefined,
        paymentStatus: itemOnline ? "initiated" : "not_required",
        receiptEmail: args.receiptEmail ?? (user as any).email,
        depositAmount,
        balanceAmount,
        depositPaid: mode === "partial" ? false : undefined,
        balancePaid: mode === "partial" ? false : undefined,
      });
      orderIds.push(orderId);

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

    if (isOnlineCheckout && paymentReference) {
      await ctx.scheduler.runAfter(0, (internal as any).payments.initiatePaystackCharge, {
        paymentReference,
        amount: amountDueNow > 0 ? amountDueNow : total,
        email: args.receiptEmail ?? (user as any).email ?? "customer@aurriq.com",
        phone: args.paymentAccount || args.buyerPhone,
        network: args.paymentNetwork,
      });
    }

    return { orderIds, total, paymentReference, paymentPending: isOnlineCheckout, amountDueNow };
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
        const product = await ctx.db.get(order.productId);
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
        const product = await ctx.db.get(order.productId);
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

    await ctx.db.patch(args.orderId, { status: args.status });
  },
});
