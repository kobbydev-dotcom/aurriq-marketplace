import { internalAction } from "./_generated/server";
import { v } from "convex/values";

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
        From: "AURRIQ",
        To: args.to,
        Content: args.message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send SMS: ${errorText}`);
    }
  },
});