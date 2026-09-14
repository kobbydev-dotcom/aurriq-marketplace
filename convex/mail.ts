"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import nodemailer from "nodemailer";

function smtpTransport() {
  const host = process.env.SMTP_SERVER;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER ?? process.env.MAIL_USERNAME;
  const password = process.env.SMTP_PASS ?? process.env.MAIL_PASSWORD;
  if (!host || !user || !password) return null;
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass: password } });
}

function defaultSender() {
  return process.env.MAIL_DEFAULT_SENDER ?? process.env.SMTP_USER ?? process.env.MAIL_USERNAME ?? "Aurriq";
}

export const sendEmail = internalAction({
  args: { to: v.string(), subject: v.string(), heading: v.string(), bodyLines: v.array(v.string()), ctaText: v.optional(v.string()), ctaUrl: v.optional(v.string()) },
  handler: async (_ctx, args) => {
    const transport = smtpTransport();
    if (!transport) { console.warn("SMTP email configuration is missing; skipping email to", args.to); return; }
    const rows = args.bodyLines.map((line) => `<p style="font-size:14px;color:#444;line-height:1.6;margin:4px 0;">${line}</p>`).join("");
    const cta = args.ctaUrl ? `<a href="${args.ctaUrl}" style="display:inline-block;margin-top:16px;background:#c9930a;color:#0c0904;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:600;">${args.ctaText ?? "Open"}</a>` : "";
    const html = `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;border:1px solid #eee;border-radius:12px;overflow:hidden;"><div style="background:#0c0904;padding:20px 24px;"><span style="color:#c9930a;font-size:20px;letter-spacing:4px;">AURRIQ</span></div><div style="padding:24px;"><p style="font-size:18px;color:#1a1a1a;margin:0 0 8px;">${args.heading}</p>${rows}${cta}</div></div>`;
    await transport.sendMail({ from: defaultSender(), to: args.to, subject: args.subject, html });
  },
});

export const sendReceiptEmail = internalAction({
  args: { to: v.string(), name: v.string(), reference: v.string(), productName: v.string(), quantity: v.number(), total: v.string(), amountPaid: v.string(), balance: v.string(), paymentMethod: v.string(), sellerName: v.string() },
  handler: async (_ctx, args) => {
    const transport = smtpTransport();
    if (!transport) { console.warn("SMTP email configuration is missing; skipping receipt email to", args.to); return; }
    const row = (label: string, value: string) => `<tr><td style="padding:6px 0;color:#8a8a8a;font-size:14px;">${label}</td><td style="padding:6px 0;text-align:right;font-size:14px;color:#1a1a1a;">${value}</td></tr>`;
    const html = `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;border:1px solid #eee;border-radius:12px;overflow:hidden;"><div style="background:#0c0904;padding:20px 24px;"><span style="color:#c9930a;font-size:20px;letter-spacing:4px;">AURRIQ</span></div><div style="padding:24px;"><p style="font-size:16px;color:#1a1a1a;">Hi ${args.name},</p><p style="font-size:14px;color:#555;">Thank you for your order. Here is your receipt.</p><table style="width:100%;border-collapse:collapse;margin-top:12px;">${row("Reference", args.reference)}${row("Item", `${args.productName} × ${args.quantity}`)}${row("Seller", args.sellerName)}${row("Payment method", args.paymentMethod)}<tr><td colspan="2" style="border-top:1px solid #eee;padding-top:8px;"></td></tr>${row("Total", args.total)}${row("Amount paid", args.amountPaid)}${row("Balance on delivery", args.balance)}</table><p style="font-size:12px;color:#999;margin-top:20px;">Keep this receipt for your records. Only transact through the official Aurriq checkout.</p></div></div>`;
    await transport.sendMail({ from: defaultSender(), to: args.to, subject: `Your Aurriq receipt (${args.reference})`, html });
  },
});
