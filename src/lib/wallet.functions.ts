import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFreshXSession } from "@/lib/session.server";
import { getRequestHost } from "@tanstack/react-start/server";

async function requireProfileId(): Promise<string> {
  const session = await getFreshXSession();
  const id = session.data?.profileId;
  if (!id) throw new Error("Not signed in");
  return id;
}

export const listTransactions = createServerFn({ method: "GET" }).handler(async () => {
  const profileId = await requireProfileId();
  const { data, error } = await supabaseAdmin
    .from("wallet_transactions")
    .select("id, type, amount, description, created_at, order_id")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    type: r.type as "credit" | "debit",
    amount: Number(r.amount),
    description: (r.description as string | null) ?? "",
    order_id: (r.order_id as string | null) ?? null,
    created_at: r.created_at as string,
  }));
});

// Initialize a Flutterwave Standard checkout for a wallet top-up. Returns a
// hosted payment link. Verification happens on the return route.
export const initWalletTopUp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        amount: z.number().int().min(500).max(1_000_000),
        email: z.string().email().max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const profileId = await requireProfileId();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, whatsapp_number")
      .eq("id", profileId)
      .single();

    const tx_ref = `FX-TOPUP-${profileId.slice(0, 8)}-${Date.now()}`;

    // Build redirect URL from incoming request host so it works in preview/prod
    const host = getRequestHost();
    const proto = host.includes("localhost") ? "http" : "https";
    const redirect_url = `${proto}://${host}/wallet-verify`;

    const { initFlutterwavePayment } = await import("@/lib/flutterwave.server");
    const { link } = await initFlutterwavePayment({
      tx_ref,
      amount: data.amount,
      redirect_url,
      customer: {
        email: data.email,
        name: profile?.full_name ?? undefined,
        phonenumber: profile?.whatsapp_number ?? undefined,
      },
      meta: { profile_id: profileId, kind: "wallet_topup" },
    });

    return { ok: true, payment_link: link, tx_ref };
  });

// Verify a returned Flutterwave transaction and credit the wallet.
// Idempotent: refuses to credit twice for the same tx_ref.
// Falls back to meta.profile_id from the verified Flutterwave transaction
// when the browser session cookie is missing (e.g. after a long checkout).
export const verifyWalletTopUp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        transaction_id: z.string().min(1).max(100),
        tx_ref: z.string().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await getFreshXSession();
    const sessionProfileId = session.data?.profileId ?? null;

    const { verifyFlutterwavePayment } = await import("@/lib/flutterwave.server");
    const result = await verifyFlutterwavePayment(data.transaction_id);

    if (result.status !== "successful") {
      throw new Error(`Payment ${result.status}. No funds were added.`);
    }
    if (result.tx_ref !== data.tx_ref) {
      throw new Error("Transaction reference mismatch.");
    }
    if (result.currency !== "NGN") {
      throw new Error(`Unsupported currency ${result.currency}.`);
    }

    // Pull profile_id from Flutterwave meta as a fallback when no session.
    const metaProfileId = typeof result.meta?.profile_id === "string" ? (result.meta.profile_id as string) : undefined;
    const profileId = sessionProfileId ?? metaProfileId;
    if (!profileId) {
      throw new Error("Could not identify the wallet to credit. Please sign in and try again.");
    }
    if (sessionProfileId && metaProfileId && sessionProfileId !== metaProfileId) {
      throw new Error("Session does not match payment owner.");
    }

    const { creditWalletTopUp } = await import("@/lib/wallet-credit.server");
    const credit = await creditWalletTopUp({
      profile_id: profileId,
      amount: Math.round(result.amount),
      tx_ref: data.tx_ref,
      flw_ref: result.flw_ref,
    });
    return {
      ok: true,
      already_processed: credit.already_processed,
      new_balance: credit.new_balance,
      amount: credit.amount,
    };
  });
