import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const DASHBOARD_URL = process.env.AURRIQ_PUBLIC_URL
  ? `${process.env.AURRIQ_PUBLIC_URL}/seller/dashboard`
  : "https://aurriq.doabookpro.com/seller/dashboard";

// Notify a seller instantly when a buyer checks out their product:
// SMS (with a direct dashboard link) + optional email + in-app notification + activity log.
export const notifySellerOfOrder = internalMutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const order: any = await ctx.db.get(args.orderId);
    if (!order) return;
    const product: any = await ctx.db.get(order.productId);
    const seller: any = await ctx.db.get(order.sellerId);
    const buyer: any = await ctx.db.get(order.buyerId);
    if (!seller) return;

    const qty = order.quantity ?? 1;
    const total = order.totalAmount ?? 0;
    const productName = product?.name ?? "an item";
    const buyerName = buyer?.name ?? "A buyer";

    const summary = `${buyerName} ordered ${productName} x${qty} (GHS ${total.toFixed(2)}). Ref ${order.paymentReference ?? order._id}.`;

    // 1. SMS with a direct link to the seller dashboard.
    if (seller.phone) {
      await ctx.scheduler.runAfter(0, internal.sms.sendSMS, {
        to: seller.phone,
        message: `AURRIQ: New order! ${summary} Arrange delivery here: ${DASHBOARD_URL}`,
      });
    }

    // 2. Email (optional) to the seller's notification email or account email.
    const sellerEmail = seller.notifyEmail ?? seller.email;
    if (sellerEmail) {
      await ctx.scheduler.runAfter(0, internal.mail.sendEmail, {
        to: sellerEmail,
        subject: `New order: ${productName} x${qty}`,
        heading: `You have a new order, ${seller.name ?? "Seller"}`,
        bodyLines: [
          summary,
          `Buyer: ${buyerName}${order.buyerPhone ? ` · ${order.buyerPhone}` : ""}`,
          order.buyerNote ? `Note: ${order.buyerNote}` : "",
          "Open your dashboard to arrange and deliver the item.",
        ].filter(Boolean),
        ctaText: "Open Seller Dashboard",
        ctaUrl: DASHBOARD_URL,
      });
    }

    // 3. In-app notification + activity log.
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: order.sellerId,
      type: "order_placed",
      title: "New order received",
      body: summary,
      link: "/seller/dashboard",
    });
    await ctx.runMutation(internal.notifications.logActivity, {
      userId: order.sellerId,
      action: `New order: ${productName} x${qty} — GHS ${total.toFixed(2)}`,
      meta: { orderId: order._id, productId: order.productId, total, quantity: qty },
    });
  },
});

// Build the human-readable receipt lines shared by SMS + email.
async function buildReceipt(ctx: any, orderId: string) {
  const order: any = await ctx.db.get(orderId);
  if (!order) return null;
  const product: any = await ctx.db.get(order.productId);
  const buyer: any = await ctx.db.get(order.buyerId);
  const seller: any = await ctx.db.get(order.sellerId);

  const qty = order.quantity ?? 1;
  const total = order.totalAmount ?? 0;
  const paidOnline = order.paymentStatus === "paid" || order.depositPaid;
  const amountPaid = order.depositAmount != null && order.balanceAmount != null
    ? (order.depositPaid ? order.depositAmount : 0) + (order.balancePaid ? order.balanceAmount : 0)
    : paidOnline ? total : 0;
  const balance = Math.max(0, total - amountPaid);

  return {
    reference: order.paymentReference ?? order._id,
    productName: product?.name ?? "Item",
    quantity: qty,
    total,
    amountPaid,
    balance,
    paymentMethod: order.paymentMethod ?? "—",
    status: order.status,
    buyerName: buyer?.name ?? "Customer",
    buyerPhone: order.buyerPhone ?? buyer?.phone,
    receiptEmail: order.receiptEmail ?? buyer?.email,
    sellerName: seller?.name ?? "Aurriq Seller",
  };
}

function formatGhs(n: number) {
  return `GHS ${n.toFixed(2)}`;
}

// Internal mutation: gather receipt data and fan out SMS + email actions.
export const sendOrderReceipt = internalMutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const r = await buildReceipt(ctx, args.orderId);
    if (!r) return;

    const lines = [
      `AURRIQ RECEIPT`,
      `Ref: ${r.reference}`,
      `Item: ${r.productName} x${r.quantity}`,
      `Total: ${formatGhs(r.total)}`,
      `Paid: ${formatGhs(r.amountPaid)}`,
      r.balance > 0 ? `Balance on delivery: ${formatGhs(r.balance)}` : `Balance: ${formatGhs(0)}`,
      `Method: ${r.paymentMethod}`,
      `Seller: ${r.sellerName}`,
      `Thank you for shopping on Aurriq.`,
    ].filter(Boolean);
    const message = lines.join("\n");

    if (r.buyerPhone) {
      await ctx.scheduler.runAfter(0, internal.sms.sendSMS, {
        to: r.buyerPhone,
        message,
      });
    }

    if (r.receiptEmail) {
      await ctx.scheduler.runAfter(0, internal.mail.sendReceiptEmail, {
        to: r.receiptEmail,
        name: r.buyerName,
        reference: String(r.reference),
        productName: r.productName,
        quantity: r.quantity,
        total: formatGhs(r.total),
        amountPaid: formatGhs(r.amountPaid),
        balance: formatGhs(r.balance),
        paymentMethod: r.paymentMethod,
        sellerName: r.sellerName,
      });
    }
  },
});

