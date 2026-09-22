import { internalAction } from "./_generated/server";
import { v } from "convex/values";

function normalizeGhanaPhone(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length === 10 && digits.startsWith("0")) return `233${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("233")) return digits;
  if (digits.length === 9) return `233${digits}`;
  return digits;
}

export const sendSMS = internalAction({
  args: {
    to: v.string(),
    message: v.string(),
  },
  handler: async (_ctx, args) => {
    const url = "https://sms-api.hubtel.com/v1/messages/send";
    
    // Accessing environment variables via process.env (now that @types/node is installed)
    const clientId = process.env.HUBTEL_CLIENT_ID;
    const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
    const senderId = process.env.HUBTEL_SENDER_ID ?? "AURRIQ";

    if (!clientId || !clientSecret) {
      throw new Error("Missing HUBTEL_CLIENT_ID or HUBTEL_CLIENT_SECRET");
    }

    const authHeader = btoa(`${clientId}:${clientSecret}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authHeader}`,
      },
      body: JSON.stringify({
        From: senderId,
        To: normalizeGhanaPhone(args.to),
        Content: args.message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send SMS: ${errorText}`);
    }
  },
});
