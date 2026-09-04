import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
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

// Paystack webhook: verify the x-paystack-signature (HMAC SHA512 of the raw body)
// and settle the order via the shared payment logic.
http.route({
	path: "/webhooks/paystack",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const secret = process.env.PAYSTACK_SECRET_KEY;
		if (!secret) return new Response("not configured", { status: 500 });

		const raw = await request.text();
		const signature = request.headers.get("x-paystack-signature") ?? "";

		const key = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(secret),
			{ name: "HMAC", hash: "SHA-512" },
			false,
			["sign"]
		);
		const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
		const computed = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
		if (computed !== signature) return new Response("invalid signature", { status: 401 });

		const body = JSON.parse(raw);
		if (body?.event === "charge.success") {
			const data = body.data ?? {};
			await ctx.runMutation(internal.payments.applyPaymentWebhook, {
				paymentReference: String(data.reference),
				status: "success",
				transactionId: data.id ? String(data.id) : undefined,
				providerPayload: body,
			});
		} else if (body?.event === "charge.failed") {
			const data = body.data ?? {};
			await ctx.runMutation(internal.payments.applyPaymentWebhook, {
				paymentReference: String(data.reference),
				status: "failed",
				transactionId: data.id ? String(data.id) : undefined,
				providerPayload: body,
			});
		}

		return new Response("ok", { status: 200 });
	}),
});

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

// Public JSON: a seller's storefront, by Convex sellerId or DOABookPro slug.
// Lets the DOABookPro client booking page embed the owner's shop with no auth.
http.route({
	path: "/storefront",
	method: "OPTIONS",
	handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});
http.route({
	path: "/storefront",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const sellerId = url.searchParams.get("sellerId");
		const slug = url.searchParams.get("slug");
		if (!sellerId && !slug) {
			return new Response(JSON.stringify({ error: "Provide sellerId or slug" }), {
				status: 400,
				headers: { "Content-Type": "application/json", ...CORS_HEADERS },
			});
		}
		const data = await ctx.runQuery(api.users.getStorefront, {
			sellerId: sellerId ? (sellerId as any) : undefined,
			slug: slug ?? undefined,
		});
		return new Response(JSON.stringify(data), {
			status: 200,
			headers: { "Content-Type": "application/json", ...CORS_HEADERS },
		});
	}),
});

export default http;