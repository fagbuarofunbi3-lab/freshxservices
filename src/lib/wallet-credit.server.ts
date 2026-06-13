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
  const { data, error } = await supabaseAdmin.rpc("credit_wallet_topup_atomic", {
    _profile_id: args.profile_id,
    _amount: Math.round(args.amount),
    _tx_ref: args.tx_ref,
  });
  if (error) throw new Error(`Failed to credit wallet: ${error.message}`);
  const row = data?.[0];
  if (!row) throw new Error("Failed to credit wallet: no result returned");
  return {
    already_processed: row.already_processed,
    new_balance: Number(row.new_balance),
    amount: Number(row.amount),
    profile_id: row.profile_id,
  };
}
