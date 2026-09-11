// Server-only helper that credits a wallet top-up idempotently.
// Also pays out a referral commission to the promo code owner when present.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CreditResult = {
  already_processed: boolean;
  new_balance: number;
  amount: number;
  profile_id: string;
};

export async function creditWalletTopUp(args: {
  profile_id: string;
  amount: number;
  tx_ref: string;
  flw_ref?: string;
  promo_owner_profile_id?: string | null;
  promo_commission_amount?: number;
  promo_code?: string | null;
}): Promise<CreditResult> {
  const { data, error } = await supabaseAdmin.rpc("credit_wallet_topup_atomic", {
    _profile_id: args.profile_id,
    _amount: Math.round(args.amount),
    _tx_ref: args.tx_ref,
  });
  let row = data?.[0];

  if (error) {
    // If RPC is blocked by permission (e.g. anon key used without service_role key), fall back to direct profile update
    if (error.code === "42501" || /permission denied/i.test(error.message)) {
      console.warn("[wallet-credit] credit_wallet_topup_atomic blocked by permissions, falling back to direct update");
      const { data: p, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("wallet_balance")
        .eq("id", args.profile_id)
        .single();
      if (pErr) throw new Error(`Failed to fetch wallet: ${pErr.message}`);

      const newBal = Number(p.wallet_balance ?? 0) + Math.round(args.amount);
      const { error: updErr } = await supabaseAdmin
        .from("profiles")
        .update({ wallet_balance: newBal })
        .eq("id", args.profile_id);
      if (updErr) throw new Error(`Failed to credit wallet: ${updErr.message}`);

      try {
        await supabaseAdmin.from("wallet_transactions").insert({
          profile_id: args.profile_id,
          type: "credit",
          amount: Math.round(args.amount),
          description: `Wallet top-up (Flutterwave ${args.tx_ref})`,
        });
      } catch {
        // Best effort
      }

      row = {
        already_processed: false,
        new_balance: newBal,
        amount: Math.round(args.amount),
        profile_id: args.profile_id,
      };
    } else {
      throw new Error(`Failed to credit wallet: ${error.message}`);
    }
  }

  if (!row) throw new Error("Failed to credit wallet: no result returned");

  // Best-effort referral commission. Failures here MUST NOT roll back the
  // payer's credit — they paid and deserve their funds. We just log.
  if (
    args.promo_owner_profile_id &&
    args.promo_owner_profile_id !== args.profile_id &&
    (args.promo_commission_amount ?? 0) > 0
  ) {
    try {
      const { error: commErr } = await supabaseAdmin.rpc("credit_promo_commission", {
        _owner_profile_id: args.promo_owner_profile_id,
        _commission_amount: Math.round(args.promo_commission_amount ?? 0),
        _tx_ref: args.tx_ref,
        _promo_code: args.promo_code ?? "",
      });
      if (commErr) console.error("[wallet-credit] commission failed", commErr.message);
    } catch (err) {
      console.error("[wallet-credit] commission threw", err);
    }
  }

  return {
    already_processed: row.already_processed,
    new_balance: Number(row.new_balance),
    amount: Number(row.amount),
    profile_id: row.profile_id,
  };
}
