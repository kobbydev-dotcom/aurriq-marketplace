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

// Hubtel webhook endpoint: keep the checkout settlement path but remove the
// legacy Paystack connection from the platform entirely.
http.route({
	path: "/webhooks/hubtel",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const secret = process.env.HUBTEL_WEBHOOK_SECRET ?? process.env.HUBTEL_CLIENT_SECRET;
		if (!secret) return new Response("not configured", { status: 500 });

		const signature = request.headers.get("x-hubtel-signature") ?? request.headers.get("authorization")?.replace("Bearer ", "") ?? "";
		if (!signature || signature !== secret) {
			return new Response("unauthorized", { status: 401 });
		}

		const body = await request.json().catch(() => ({}));
		const reference = body?.reference ?? body?.clientReference ?? body?.data?.reference;
		const status = String(body?.status ?? body?.data?.status ?? "").toLowerCase();
		const transactionId = body?.transactionId ?? body?.data?.transactionId ?? body?.id;

		if (!reference) return new Response("missing reference", { status: 400 });

		const normalizedStatus = status === "success" || status === "paid" || status === "completed"
			? "success"
			: status === "failed" || status === "cancelled" || status === "declined"
				? "failed"
				: "pending";

		if (normalizedStatus === "success" || normalizedStatus === "failed") {
			if (String(reference).startsWith("AURRIQ-VENDOR-")) {
				await ctx.runMutation(internal.payments.applyMarketplaceSubscription, {
					paymentReference: String(reference),
					status: normalizedStatus,
					transactionId: transactionId ? String(transactionId) : undefined,
				});
			} else {
				await ctx.runMutation(internal.payments.applyPaymentWebhook, {
					paymentReference: String(reference),
					status: normalizedStatus,
					transactionId: transactionId ? String(transactionId) : undefined,
					providerPayload: body,
				});
			}
		}

		return new Response("ok", { status: 200 });
	}),
});

http.route({
	path: "/superadmin/activate-marketplace-subscription",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const secret = request.headers.get("authorization")?.replace("Bearer ", "") ?? request.headers.get("x-activation-secret") ?? "";
		const expected = process.env.DOABOOKPRO_MARKETPLACE_SECRET;
		if (!expected || secret !== expected) {
			return new Response("unauthorized", { status: 401 });
		}

		const body = await request.json().catch(() => ({}));
		const paymentReference = body?.paymentReference ?? body?.reference;
		if (!paymentReference) return new Response("missing paymentReference", { status: 400 });

		await ctx.runMutation((api.payments as any).activateMarketplaceSubscriptionFromSuperadmin, {
			paymentReference: String(paymentReference),
			activationSecret: secret,
			transactionId: body?.transactionId ? String(body.transactionId) : undefined,
			doabookproEmail: typeof body?.doabookproEmail === "string" ? body.doabookproEmail : undefined,
			doabookproLinkUrl: typeof body?.doabookproLinkUrl === "string" ? body.doabookproLinkUrl : undefined,
		});

		return new Response(JSON.stringify({ activated: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

http.route({
	path: "/doabookpro/business-link-complete",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-doabookpro-marketplace-secret") ?? "";
		const expected = process.env.DOABOOKPRO_MARKETPLACE_SECRET;
		if (!expected || secret !== expected) return new Response("unauthorized", { status: 401 });

		const body = await request.json().catch(() => null);
		if (typeof body?.sellerId !== "string" || typeof body?.ownerEmail !== "string" || typeof body?.businessSlug !== "string") {
			return new Response(JSON.stringify({ error: "missing sellerId, ownerEmail, or businessSlug" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		try {
			const result = await ctx.runMutation((internal.users as any).completeDoabookproBusinessLink, {
				sellerId: body.sellerId,
				ownerEmail: body.ownerEmail,
				businessSlug: body.businessSlug,
			});
			return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
		} catch (error) {
			return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Business link could not be completed" }), {
				status: 409,
				headers: { "Content-Type": "application/json" },
			});
		}
	}),
});

http.route({
	path: "/superadmin/reject-marketplace-subscription",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const secret = request.headers.get("authorization")?.replace("Bearer ", "") ?? request.headers.get("x-activation-secret") ?? "";
		const expected = process.env.DOABOOKPRO_MARKETPLACE_SECRET;
		if (!expected || secret !== expected) {
			return new Response("unauthorized", { status: 401 });
		}

		const body = await request.json().catch(() => ({}));
		const paymentReference = body?.paymentReference ?? body?.reference;
		if (!paymentReference) return new Response("missing paymentReference", { status: 400 });

		await ctx.runMutation((api.payments as any).rejectMarketplaceSubscriptionFromSuperadmin, {
			paymentReference: String(paymentReference),
			activationSecret: secret,
			transactionId: body?.transactionId ? String(body.transactionId) : undefined,
		});

		return new Response(JSON.stringify({ rejected: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

http.route({
	path: "/public-stats",
	method: "OPTIONS",
	handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});
http.route({
	path: "/public-stats",
	method: "GET",
	handler: httpAction(async (ctx) => {
		const stats = await ctx.runQuery(api.platform.getLiveStats, {});
		return new Response(JSON.stringify({ buyers: stats.buyers, vendors: stats.vendors }), {
			status: 200,
			headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS_HEADERS },
		});
	}),
});
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
