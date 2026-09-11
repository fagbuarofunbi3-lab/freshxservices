// Flutterwave webhook receiver. Configure the endpoint in your Flutterwave
// dashboard (Settings -> Webhooks) and set a "Secret hash" that matches the
// FLUTTERWAVE_WEBHOOK_HASH env var. Flutterwave sends that hash in the
// `verif-hash` header on every webhook delivery.
import { createFileRoute } from "@tanstack/react-router";
import { getFlutterwaveWebhookHash } from "@/lib/flutterwave.server";

export const Route = createFileRoute("/api/public/flutterwave-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = getFlutterwaveWebhookHash();
        // Flutterwave has used several header names across versions/dashboards.
        const got =
          request.headers.get("verif-hash") ||
          request.headers.get("verifi-hash") ||
          request.headers.get("flutterwave-signature") ||
          request.headers.get("x-flutterwave-signature") ||
          request.headers.get("x-verif-hash");
        if (!expected) {
          console.error("[flw-webhook] FLUTTERWAVE_WEBHOOK_HASH is not configured");
          return new Response("Webhook secret not configured", { status: 500 });
        }
        if (!got || got.trim() !== expected.trim()) {
          // Log header names (not values) to help diagnose dashboard config.
          const headerNames: string[] = [];
          request.headers.forEach((_v, k) => headerNames.push(k));
          console.warn("[flw-webhook] Invalid signature", {
            got: got ? `${got.slice(0, 4)}…(len=${got.length})` : null,
            expectedLen: expected.length,
            headerNames,
          });
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const data = payload?.data ?? payload;
        const status: string = data?.status ?? "";
        const tx_ref: string = data?.tx_ref ?? "";
        const flw_ref: string | undefined = data?.flw_ref;
        const amount = Number(data?.amount ?? 0);
        const currency: string = data?.currency ?? "NGN";
        const transaction_id = data?.id;
        const meta = data?.meta ?? data?.meta_data ?? {};
        const payloadProfileId: string | undefined =
          typeof meta?.profile_id === "string" ? meta.profile_id : undefined;

        if (!tx_ref || !transaction_id) {
          return new Response("Missing tx fields", { status: 400 });
        }
        if (status !== "successful") {
          // Acknowledge non-success events so Flutterwave doesn't retry forever.
          return new Response("ok", { status: 200 });
        }
        if (currency !== "NGN") {
          console.warn("[flw-webhook] Unsupported currency", currency);
          return new Response("ok", { status: 200 });
        }

        // Re-verify with Flutterwave before crediting (defense in depth).
        const { verifyFlutterwavePayment } = await import("@/lib/flutterwave.server");
        try {
          const verified = await verifyFlutterwavePayment(transaction_id);
          if (verified.status !== "successful" || verified.tx_ref !== tx_ref) {
            console.warn("[flw-webhook] Verify mismatch", { verified, tx_ref });
            return new Response("Verify failed", { status: 400 });
          }

          // Resolve the profile: webhook meta → verified meta → tx_ref prefix.
          let profile_id =
            payloadProfileId ??
            (typeof verified.meta?.profile_id === "string"
              ? (verified.meta.profile_id as string)
              : undefined);
          if (!profile_id && /^FX-TOPUP-[0-9a-f]{8}-\d+$/i.test(tx_ref)) {
            const prefix = tx_ref.split("-")[2].toLowerCase();
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: matches } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .like("id", `${prefix}%`)
              .limit(2);
            if (matches && matches.length === 1) profile_id = matches[0].id as string;
          }
          if (!profile_id) {
            console.error("[flw-webhook] Could not resolve profile for tx_ref", tx_ref);
            return new Response("Missing profile_id", { status: 400 });
          }

          const promoOwnerId =
            typeof verified.meta?.promo_owner_profile_id === "string"
              ? (verified.meta.promo_owner_profile_id as string)
              : null;
          const promoCommission = Number(verified.meta?.promo_commission_amount ?? 0);
          const promoCode =
            typeof verified.meta?.promo_code === "string" ? (verified.meta.promo_code as string) : null;

          const { creditWalletTopUp } = await import("@/lib/wallet-credit.server");
          const result = await creditWalletTopUp({
            profile_id,
            amount: Math.round(verified.amount || amount),
            tx_ref,
            flw_ref,
            promo_owner_profile_id: promoOwnerId && promoOwnerId !== profile_id ? promoOwnerId : null,
            promo_commission_amount: promoCommission > 0 ? Math.round(promoCommission) : 0,
            promo_code: promoCode,
          });
          console.log("[flw-webhook] Credited", { tx_ref, ...result });
          return new Response("ok", { status: 200 });
        } catch (err) {
          console.error("[flw-webhook] Crediting failed", err);
          return new Response("Internal error", { status: 500 });
        }
      },
    },
  },
});
