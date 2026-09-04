import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";

async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

// Buyer submits a Request for Quotation (bulk / custom order).
export const submitRfq = mutation({
  args: {
    sellerId: v.id("users"),
    productId: v.optional(v.id("products")),
    quantity: v.number(),
    targetPrice: v.optional(v.number()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in to request a quote" });
    if (me._id === args.sellerId) throw new ConvexError({ code: "BAD_REQUEST", message: "You can't request a quote from yourself" });
    if (args.quantity < 1) throw new ConvexError({ code: "BAD_REQUEST", message: "Quantity must be at least 1" });

    const id = await ctx.db.insert("rfqs", {
      buyerId: me._id,
      sellerId: args.sellerId,
      productId: args.productId,
      quantity: args.quantity,
      targetPrice: args.targetPrice,
      message: args.message,
      status: "open",
    });

    const product: any = args.productId ? await ctx.db.get(args.productId) : null;
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: args.sellerId,
      type: "rfq",
      title: "New quote request",
      body: `${me.name ?? "A buyer"} requested a quote for ${args.quantity} × ${product?.name ?? "a product"}.`,
      link: "/seller/dashboard",
    });
    return id;
  },
});

export const getMyRfqs = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const rfqs = await ctx.db.query("rfqs").withIndex("by_buyer", (q) => q.eq("buyerId", me._id)).order("desc").collect();
    return await Promise.all(rfqs.map(async (r) => {
      const product: any = r.productId ? await ctx.db.get(r.productId) : null;
      const seller: any = await ctx.db.get(r.sellerId);
      return { ...r, productName: product?.name, productImage: product?.images?.[0], sellerName: seller?.name };
    }));
  },
});

export const getSellerRfqs = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const rfqs = await ctx.db.query("rfqs").withIndex("by_seller", (q) => q.eq("sellerId", me._id)).order("desc").collect();
    return await Promise.all(rfqs.map(async (r) => {
      const product: any = r.productId ? await ctx.db.get(r.productId) : null;
      const buyer: any = await ctx.db.get(r.buyerId);
      return { ...r, productName: product?.name, productImage: product?.images?.[0], buyerName: buyer?.name, buyerPhone: buyer?.phone };
    }));
  },
});

// Seller responds to an RFQ with a quoted price.
export const respondToRfq = mutation({
  args: {
    rfqId: v.id("rfqs"),
    status: v.union(v.literal("quoted"), v.literal("declined")),
    quotedPrice: v.optional(v.number()),
    sellerNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    const rfq = await ctx.db.get(args.rfqId);
    if (!rfq) throw new ConvexError({ code: "NOT_FOUND", message: "RFQ not found" });
    if (rfq.sellerId !== me._id) throw new ConvexError({ code: "FORBIDDEN", message: "Not your RFQ" });

    await ctx.db.patch(args.rfqId, {
      status: args.status,
      quotedPrice: args.quotedPrice,
      sellerNote: args.sellerNote,
    });

    await ctx.runMutation(internal.notifications.createNotification, {
      userId: rfq.buyerId,
      type: "rfq_response",
      title: args.status === "quoted" ? "Your quote is ready" : "Quote request declined",
      body: args.status === "quoted"
        ? `A seller quoted GHS ${(args.quotedPrice ?? 0).toFixed(2)} for your request.`
        : `A seller declined your quote request.`,
      link: "/orders",
    });
    return true;
  },
});

// Buyer accepts a quoted RFQ.
export const acceptRfq = mutation({
  args: { rfqId: v.id("rfqs") },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    const rfq = await ctx.db.get(args.rfqId);
    if (!rfq) throw new ConvexError({ code: "NOT_FOUND", message: "RFQ not found" });
    if (rfq.buyerId !== me._id) throw new ConvexError({ code: "FORBIDDEN", message: "Not your RFQ" });
    if (rfq.status !== "quoted") throw new ConvexError({ code: "BAD_REQUEST", message: "This request hasn't been quoted yet" });

    await ctx.db.patch(args.rfqId, { status: "accepted" });
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: rfq.sellerId,
      type: "rfq_accepted",
      title: "Quote accepted",
      body: `Your quote of GHS ${(rfq.quotedPrice ?? 0).toFixed(2)} was accepted.`,
      link: "/seller/dashboard",
    });
    return true;
  },
});
