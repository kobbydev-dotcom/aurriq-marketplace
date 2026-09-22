import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const DEFAULT_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

async function currentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

function itemSummary(items: string[]) {
  const unique = [...new Set(items.filter(Boolean))];
  if (unique.length === 0) return "your last order";
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, 2).join(", ")} and ${unique.length - 2} more item${unique.length - 2 === 1 ? "" : "s"}`;
}

function buildMessage(args: { buyerName?: string; sellerName?: string; itemSummary: string; days: number; template?: string }) {
  const fallback = `Hi {buyerName}, this is {sellerName} from Aurriq. It has been a while since you bought {items}. We are checking in with you. When next would you like to purchase?`;
  return (args.template || fallback)
    .replace(/{buyerName}/g, args.buyerName || "there")
    .replace(/{sellerName}/g, args.sellerName || "your Aurriq vendor")
    .replace(/{items}/g, args.itemSummary)
    .replace(/{days}/g, String(args.days));
}

async function buildBuyerSummaries(ctx: any, seller: any) {
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_seller", (q: any) => q.eq("sellerId", seller._id))
    .collect();
  const activeOrders = orders.filter((order: any) => order.status !== "cancelled" && order.paymentStatus !== "initiated");
  const buyerMap = new Map<string, any>();

  for (const order of activeOrders) {
    const buyerKey = String(order.buyerId);
    const product: any = await ctx.db.get(order.productId);
    const buyer: any = await ctx.db.get(order.buyerId);
    const existing = buyerMap.get(buyerKey) ?? {
      buyerId: order.buyerId,
      buyerName: buyer?.name ?? "Buyer",
      buyerPhone: order.buyerPhone ?? buyer?.phone,
      buyerEmail: buyer?.email,
      totalOrders: 0,
      totalSpent: 0,
      lastOrderAt: 0,
      lastItems: [] as string[],
      lastOrderId: order._id,
      lastReminderAt: undefined as number | undefined,
    };

    existing.totalOrders += 1;
    existing.totalSpent += order.totalAmount ?? 0;
    if (order._creationTime > existing.lastOrderAt) {
      existing.lastOrderAt = order._creationTime;
      existing.lastOrderId = order._id;
      existing.buyerPhone = order.buyerPhone ?? buyer?.phone;
      existing.lastItems = [product?.name ?? "your last item"];
    } else if (order._creationTime === existing.lastOrderAt) {
      existing.lastItems.push(product?.name ?? "your last item");
    }
    buyerMap.set(buyerKey, existing);
  }

  const rows = [];
  for (const row of buyerMap.values()) {
    const reminders = await ctx.db
      .query("sellerRetentionReminders")
      .withIndex("by_seller_buyer", (q: any) => q.eq("sellerId", seller._id).eq("buyerId", row.buyerId))
      .collect();
    const latest = reminders.sort((a: any, b: any) => b.sentAt - a.sentAt)[0];
    rows.push({
      ...row,
      itemSummary: itemSummary(row.lastItems),
      daysSinceLastOrder: Math.floor((Date.now() - row.lastOrderAt) / DAY_MS),
      lastReminderAt: latest?.sentAt,
    });
  }

  return rows.sort((a, b) => b.lastOrderAt - a.lastOrderAt);
}

export const getSellerBuyerHistory = query({
  args: {},
  handler: async (ctx) => {
    const seller: any = await currentUser(ctx);
    if (!seller) return { settings: null, buyers: [] };
    const buyers = await buildBuyerSummaries(ctx, seller);
    return {
      settings: {
        enabled: seller.marketplaceRetentionEnabled ?? true,
        days: seller.marketplaceRetentionDays ?? DEFAULT_RETENTION_DAYS,
        template: seller.marketplaceRetentionTemplate,
      },
      buyers,
    };
  },
});

export const updateRetentionSettings = mutation({
  args: {
    enabled: v.boolean(),
    days: v.number(),
    template: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const seller: any = await currentUser(ctx);
    if (!seller) throw new Error("Not authenticated");
    if (!(seller.isSeller || seller.role === "seller")) throw new Error("Seller account required");
    await ctx.db.patch(seller._id, {
      marketplaceRetentionEnabled: args.enabled,
      marketplaceRetentionDays: Math.max(1, Math.min(365, Math.round(args.days))),
      marketplaceRetentionTemplate: args.template?.trim() || undefined,
    });
    return { saved: true };
  },
});

export const sendBuyerRetentionSms = mutation({
  args: { buyerId: v.id("users") },
  handler: async (ctx, args) => {
    const seller: any = await currentUser(ctx);
    if (!seller) throw new Error("Not authenticated");
    const buyers = await buildBuyerSummaries(ctx, seller);
    const buyer = buyers.find((row) => row.buyerId === args.buyerId);
    if (!buyer) throw new Error("Buyer history not found");
    if (!buyer.buyerPhone) throw new Error("This buyer has no phone number saved for SMS");

    const days = seller.marketplaceRetentionDays ?? DEFAULT_RETENTION_DAYS;
    const message = buildMessage({
      buyerName: buyer.buyerName,
      sellerName: seller.name,
      itemSummary: buyer.itemSummary,
      days,
      template: seller.marketplaceRetentionTemplate,
    });
    await ctx.scheduler.runAfter(0, internal.sms.sendSMS, { to: buyer.buyerPhone, message });
    await ctx.db.insert("sellerRetentionReminders", {
      sellerId: seller._id,
      buyerId: args.buyerId,
      buyerPhone: buyer.buyerPhone,
      lastOrderAt: buyer.lastOrderAt,
      sentAt: Date.now(),
      intervalDays: days,
      itemSummary: buyer.itemSummary,
      message,
      status: "sent",
    });
    return { sent: true };
  },
});

export const runRetentionReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sellers = (await ctx.db.query("users").collect()).filter((user: any) => {
      return (user.isSeller || user.role === "seller")
        && user.marketplaceSubscriptionStatus === "active"
        && user.marketplaceRetentionEnabled !== false;
    });
    let sent = 0;

    for (const seller of sellers) {
      const days = seller.marketplaceRetentionDays ?? DEFAULT_RETENTION_DAYS;
      const buyers = await buildBuyerSummaries(ctx, seller);
      for (const buyer of buyers) {
        if (!buyer.buyerPhone || buyer.daysSinceLastOrder < days) continue;
        if (buyer.lastReminderAt && buyer.lastReminderAt >= buyer.lastOrderAt) continue;
        const message = buildMessage({
          buyerName: buyer.buyerName,
          sellerName: seller.name,
          itemSummary: buyer.itemSummary,
          days,
          template: seller.marketplaceRetentionTemplate,
        });
        await ctx.scheduler.runAfter(0, internal.sms.sendSMS, { to: buyer.buyerPhone, message });
        await ctx.db.insert("sellerRetentionReminders", {
          sellerId: seller._id,
          buyerId: buyer.buyerId,
          buyerPhone: buyer.buyerPhone,
          lastOrderAt: buyer.lastOrderAt,
          sentAt: Date.now(),
          intervalDays: days,
          itemSummary: buyer.itemSummary,
          message,
          status: "sent",
        });
        sent += 1;
      }
      await ctx.db.patch(seller._id, { marketplaceRetentionLastRunAt: Date.now() });
    }
    return { sellers: sellers.length, sent };
  },
});
