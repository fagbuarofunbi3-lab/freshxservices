// Server-only helper that credits a wallet top-up idempotently.
// Used by both the post-redirect verify flow and the Flutterwave webhook,
// so a successful payment is captured even if the user never returns to the site.
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
}): Promise<CreditResult> {
  const description = `Wallet top-up (Flutterwave ${args.tx_ref})`;

  // Idempotency: scope by profile + description so two users can't collide.
  const { data: existing } = await supabaseAdmin
    .from("wallet_transactions")
    .select("id")
    .eq("profile_id", args.profile_id)
    .eq("description", description)
    .maybeSingle();

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("wallet_balance")
    .eq("id", args.profile_id)
    .single();
  if (profileErr || !profile) {
    throw new Error(`Profile ${args.profile_id} not found: ${profileErr?.message ?? "unknown"}`);
  }
  const balance = Number(profile.wallet_balance ?? 0);

  if (existing) {
    return { already_processed: true, new_balance: balance, amount: args.amount, profile_id: args.profile_id };
  }

  const amount = Math.round(args.amount);
  const newBalance = balance + amount;
  const { error: updErr } = await supabaseAdmin
    .from("profiles")
    .update({ wallet_balance: newBalance })
    .eq("id", args.profile_id);
  if (updErr) throw new Error(`Failed to update balance: ${updErr.message}`);

  const { error: insErr } = await supabaseAdmin.from("wallet_transactions").insert({
    profile_id: args.profile_id,
    type: "credit",
    amount,
    description,
  });
  if (insErr) {
    // Roll back balance change so the user can retry.
    await supabaseAdmin.from("profiles").update({ wallet_balance: balance }).eq("id", args.profile_id);
    throw new Error(`Failed to record transaction: ${insErr.message}`);
  }

  await supabaseAdmin.from("notifications").insert({
    profile_id: args.profile_id,
    message: `Wallet topped up with ₦${amount.toLocaleString()}. New balance: ₦${newBalance.toLocaleString()}.`,
    channel: "in_app",
    type: "topup",
  });

  return { already_processed: false, new_balance: newBalance, amount, profile_id: args.profile_id };
}
