import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

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
