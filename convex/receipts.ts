import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const DASHBOARD_URL = process.env.APP_URL
  ? `${process.env.APP_URL}/seller/dashboard`
  : "https://aurriq-marketplace-live-a04ea8311137.herokuapp.com/seller/dashboard";

// Generic transactional email via Resend.
export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    heading: v.string(),
    bodyLines: v.array(v.string()),
    ctaText: v.optional(v.string()),
    ctaUrl: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not configured; skipping email to", args.to);
      return;
    }
    const from = process.env.RESEND_FROM ?? "Aurriq <notifications@aurriq.com>";
    const rows = args.bodyLines
      .map((l) => `<p style="font-size:14px;color:#444;line-height:1.6;margin:4px 0;">${l}</p>`)
      .join("");
    const cta = args.ctaUrl
      ? `<a href="${args.ctaUrl}" style="display:inline-block;margin-top:16px;background:#c9930a;color:#0c0904;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:600;">${args.ctaText ?? "Open"}</a>`
      : "";
    const html = `
      <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;border:1px solid #eee;border-radius:12px;overflow:hidden;">
        <div style="background:#0c0904;padding:20px 24px;">
          <span style="color:#c9930a;font-size:20px;letter-spacing:4px;">AURRIQ</span>
        </div>
        <div style="padding:24px;">
          <p style="font-size:18px;color:#1a1a1a;margin:0 0 8px;">${args.heading}</p>
          ${rows}
          ${cta}
        </div>
      </div>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: args.to, subject: args.subject, html }),
    });
    if (!res.ok) console.error("Resend email failed:", await res.text());
  },
});

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
      await ctx.scheduler.runAfter(0, internal.receipts.sendEmail, {
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
      await ctx.scheduler.runAfter(0, internal.receipts.sendReceiptEmail, {
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

// Send the receipt email via Resend (https://resend.com). Needs RESEND_API_KEY.
export const sendReceiptEmail = internalAction({
  args: {
    to: v.string(),
    name: v.string(),
    reference: v.string(),
    productName: v.string(),
    quantity: v.number(),
    total: v.string(),
    amountPaid: v.string(),
    balance: v.string(),
    paymentMethod: v.string(),
    sellerName: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not configured; skipping receipt email to", args.to);
      return;
    }
    const from = process.env.RESEND_FROM ?? "Aurriq <receipts@aurriq.com>";

    const row = (label: string, value: string) =>
      `<tr><td style="padding:6px 0;color:#8a8a8a;font-size:14px;">${label}</td><td style="padding:6px 0;text-align:right;font-size:14px;color:#1a1a1a;">${value}</td></tr>`;

    const html = `
      <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;border:1px solid #eee;border-radius:12px;overflow:hidden;">
        <div style="background:#0c0904;padding:20px 24px;">
          <span style="color:#c9930a;font-size:20px;letter-spacing:4px;">AURRIQ</span>
        </div>
        <div style="padding:24px;">
          <p style="font-size:16px;color:#1a1a1a;">Hi ${args.name},</p>
          <p style="font-size:14px;color:#555;">Thank you for your order. Here is your receipt.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            ${row("Reference", args.reference)}
            ${row("Item", `${args.productName} × ${args.quantity}`)}
            ${row("Seller", args.sellerName)}
            ${row("Payment method", args.paymentMethod)}
            <tr><td colspan="2" style="border-top:1px solid #eee;padding-top:8px;"></td></tr>
            ${row("Total", args.total)}
            ${row("Amount paid", args.amountPaid)}
            ${row("Balance on delivery", args.balance)}
          </table>
          <p style="font-size:12px;color:#999;margin-top:20px;">Keep this receipt for your records. Only transact through the official Aurriq checkout.</p>
        </div>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: `Your Aurriq receipt (${args.reference})`,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Resend email failed:", text);
    }
  },
});
