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
    const profileId = await requireProfileId();

    // Idempotency: have we already credited this tx_ref?
    const { data: existing } = await supabaseAdmin
      .from("wallet_transactions")
      .select("id")
      .eq("description", `Wallet top-up (Flutterwave ${data.tx_ref})`)
      .maybeSingle();
    if (existing) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("wallet_balance")
        .eq("id", profileId)
        .single();
      return { ok: true, already_processed: true, new_balance: Number(profile?.wallet_balance ?? 0) };
    }

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

    const amount = Math.round(result.amount);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("wallet_balance")
      .eq("id", profileId)
      .single();
    const balance = Number(profile?.wallet_balance ?? 0);
    const newBalance = balance + amount;
    await supabaseAdmin.from("profiles").update({ wallet_balance: newBalance }).eq("id", profileId);
    await supabaseAdmin.from("wallet_transactions").insert({
      profile_id: profileId,
      type: "credit",
      amount,
      description: `Wallet top-up (Flutterwave ${data.tx_ref})`,
    });
    await supabaseAdmin.from("notifications").insert({
      profile_id: profileId,
      message: `Wallet topped up with ₦${amount.toLocaleString()}. New balance: ₦${newBalance.toLocaleString()}.`,
      channel: "in_app",
      type: "topup",
    });
    return { ok: true, already_processed: false, new_balance: newBalance, amount };
  });
