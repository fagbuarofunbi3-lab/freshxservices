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

// Server-side promo resolver shared by preview and init flows.
async function resolveTopUpPromo(
  rawCode: string | undefined,
  payerProfileId: string,
  intendedAmount: number,
): Promise<{
  code: string | null;
  owner_profile_id: string | null;
  percentage: number;
  discount: number;
  charged_amount: number;
  message: string | null;
}> {
  const empty = {
    code: null,
    owner_profile_id: null,
    percentage: 0,
    discount: 0,
    charged_amount: intendedAmount,
    message: null as string | null,
  };
  if (!rawCode || !rawCode.trim()) return empty;
  const code = rawCode.trim().toUpperCase();

  const { data: row } = await supabaseAdmin
    .from("promo_codes")
    .select("id, code, type, value, is_active, owner_profile_id, min_order_amount, expiry_date, usage_limit, times_used")
    .ilike("code", code)
    .maybeSingle();

  if (!row) return { ...empty, message: "Promo code not found." };
  if (!row.is_active) return { ...empty, message: "Promo code is no longer active." };
  if (row.type !== "percentage")
    return { ...empty, message: "Only percentage promo codes are accepted for top-ups." };
  if (row.expiry_date && new Date(row.expiry_date as string) < new Date())
    return { ...empty, message: "Promo code has expired." };
  if (row.usage_limit != null && Number(row.times_used ?? 0) >= Number(row.usage_limit))
    return { ...empty, message: "Promo code usage limit reached." };
  if (Number(row.min_order_amount ?? 0) > intendedAmount)
    return { ...empty, message: `Minimum top-up for this code is ₦${Number(row.min_order_amount).toLocaleString()}.` };
  if (!row.owner_profile_id)
    return { ...empty, message: "This code cannot be used on top-ups." };
  if (row.owner_profile_id === payerProfileId)
    return { ...empty, message: "You cannot use your own promo code." };

  const pct = Number(row.value);
  const discount = Math.round((intendedAmount * pct) / 100);
  const charged = Math.max(100, intendedAmount - discount); // FLW minimum
  return {
    code: row.code as string,
    owner_profile_id: row.owner_profile_id as string,
    percentage: pct,
    discount,
    charged_amount: charged,
    message: null,
  };
}

// Preview a promo without starting a payment — used by the wallet UI.
export const previewTopUpPromo = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        code: z.string().trim().min(1).max(40),
        amount: z.number().int().min(500).max(1_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const profileId = await requireProfileId();
    const res = await resolveTopUpPromo(data.code, profileId, data.amount);
    return {
      ok: !res.message && !!res.code,
      message: res.message,
      code: res.code,
      percentage: res.percentage,
      discount: res.discount,
      charged_amount: res.charged_amount,
    };
  });

// Initialize a Flutterwave Standard checkout for a wallet top-up. Returns a
// hosted payment link. Verification happens on the return route.
export const initWalletTopUp = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        amount: z.number().int().min(500).max(1_000_000),
        email: z.string().email().max(200),
        promo_code: z.string().trim().min(1).max(40).optional(),
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

    const promo = await resolveTopUpPromo(data.promo_code, profileId, data.amount);
    if (data.promo_code && promo.message) {
      throw new Error(promo.message);
    }

    const tx_ref = `FX-TOPUP-${profileId.slice(0, 8)}-${Date.now()}`;
    const host = getRequestHost();
    const proto = host.includes("localhost") ? "http" : "https";
    const redirect_url = `${proto}://${host}/wallet-verify`;

    const { initFlutterwavePayment } = await import("@/lib/flutterwave.server");
    const { link } = await initFlutterwavePayment({
      tx_ref,
      amount: promo.charged_amount,
      redirect_url,
      customer: {
        email: data.email,
        name: profile?.full_name ?? undefined,
        phonenumber: profile?.whatsapp_number ?? undefined,
      },
      meta: {
        profile_id: profileId,
        kind: "wallet_topup",
        promo_code: promo.code,
        promo_owner_profile_id: promo.owner_profile_id,
        promo_commission_amount: promo.discount,
        intended_amount: data.amount,
      },
    });

    return {
      ok: true,
      payment_link: link,
      tx_ref,
      charged_amount: promo.charged_amount,
      discount: promo.discount,
      promo_code: promo.code,
    };
  });

// Verify a returned Flutterwave transaction and credit the wallet.
// Idempotent: refuses to credit twice for the same tx_ref.
export const verifyWalletTopUp = createServerFn({ method: "POST" })
  .validator((input) =>
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

    const metaProfileId = typeof result.meta?.profile_id === "string" ? (result.meta.profile_id as string) : undefined;
    const profileId = sessionProfileId ?? metaProfileId;
    if (!profileId) {
      throw new Error("Could not identify the wallet to credit. Please sign in and try again.");
    }
    if (sessionProfileId && metaProfileId && sessionProfileId !== metaProfileId) {
      throw new Error("Session does not match payment owner.");
    }

    const promoOwnerId =
      typeof result.meta?.promo_owner_profile_id === "string"
        ? (result.meta.promo_owner_profile_id as string)
        : null;
    const promoCommission = Number(result.meta?.promo_commission_amount ?? 0);
    const promoCode =
      typeof result.meta?.promo_code === "string" ? (result.meta.promo_code as string) : null;

    const { creditWalletTopUp } = await import("@/lib/wallet-credit.server");
    const credit = await creditWalletTopUp({
      profile_id: profileId,
      amount: Math.round(result.amount),
      tx_ref: data.tx_ref,
      flw_ref: result.flw_ref,
      promo_owner_profile_id: promoOwnerId && promoOwnerId !== profileId ? promoOwnerId : null,
      promo_commission_amount: promoCommission > 0 ? Math.round(promoCommission) : 0,
      promo_code: promoCode,
    });
    return {
      ok: true,
      already_processed: credit.already_processed,
      new_balance: credit.new_balance,
      amount: credit.amount,
    };
  });
