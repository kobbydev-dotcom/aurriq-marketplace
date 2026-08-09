import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

http.route({
	path: "/webhooks/momo",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const secret = request.headers.get("x-webhook-secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");
		const expected = process.env.MOMO_WEBHOOK_SECRET;
		if (!expected || secret !== expected) {
			return new Response("unauthorized", { status: 401 });
		}

		const body = await request.json();
		const reference = body?.reference ?? body?.clientReference ?? body?.data?.reference;
		const status = String(body?.status ?? body?.data?.status ?? "").toLowerCase();
		const transactionId = body?.transactionId ?? body?.data?.transactionId ?? body?.id;

		if (!reference) {
			return new Response("missing reference", { status: 400 });
		}

		const normalizedStatus = status === "success" || status === "paid" || status === "completed"
			? "success"
			: status === "failed" || status === "cancelled" || status === "declined"
				? "failed"
				: "pending";

		await ctx.runMutation((internal as any).payments.applyPaymentWebhook, {
			paymentReference: String(reference),
			status: normalizedStatus,
			transactionId: transactionId ? String(transactionId) : undefined,
			providerPayload: body,
		});

		return new Response("ok", { status: 200 });
	}),
});

export default http;