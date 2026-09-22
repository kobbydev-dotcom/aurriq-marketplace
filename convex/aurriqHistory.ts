import { internalAction } from "./_generated/server";
import { v } from "convex/values";

export const sendHistoryEvent = internalAction({
  args: {
    eventType: v.string(),
    reference: v.string(),
    sellerId: v.string(),
    sellerName: v.optional(v.string()),
    sellerEmail: v.optional(v.string()),
    sellerPhone: v.optional(v.string()),
    storeName: v.optional(v.string()),
    note: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const requestUrl = process.env.DOABOOKPRO_MARKETPLACE_REQUEST_URL;
    const secret = process.env.DOABOOKPRO_MARKETPLACE_SECRET;
    if (!requestUrl || !secret) return { skipped: true };

    const historyUrl = requestUrl.replace(/\/marketplace-activation-request\/?$/, "/marketplace-history-event");
    const response = await fetch(historyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`DOABookPro Aurriq history sync failed: ${response.status}`);
    }

    return { synced: true };
  },
});
