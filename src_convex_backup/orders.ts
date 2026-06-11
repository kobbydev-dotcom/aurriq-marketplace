import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const placeOrder = mutation({
  args: {
    buyerPhone: v.optional(v.string()),
    buyerNote: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ orderIds: string[]; total: number }> => {
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

    const orderIds: string[] = [];
    let total = 0;

    for (const item of cartItems) {
      const product = await ctx.db.get(item.productId);
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
      const totalAmount = priceAtPurchase * item.quantity;
      total += totalAmount;

      const orderId = await ctx.db.insert("orders", {
        buyerId: user._id,
        sellerId: product.sellerId,
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase,
        totalAmount,
        status: "pending",
        buyerPhone: args.buyerPhone,
        buyerNote: args.buyerNote,
      });
      orderIds.push(orderId);

      // Decrement stock
      const newStock = product.stockQuantity - item.quantity;
      await ctx.db.patch(item.productId, {
        stockQuantity: newStock,
        totalSold: product.totalSold + item.quantity,
        totalRevenue: product.totalRevenue + totalAmount,
      });

      // Trigger SMS alerts if needed
      await ctx.scheduler.runAfter(0, internal.inventory.checkAndSendAlerts, {
        productId: item.productId,
      });
    }

    // Clear cart
    await Promise.all(cartItems.map((item) => ctx.db.delete(item._id)));

    return { orderIds, total };
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
