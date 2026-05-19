import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFreshXSession } from "@/lib/session.server";

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

export const topUpStub = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ amount: z.number().int().min(500).max(1_000_000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const profileId = await requireProfileId();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("wallet_balance")
      .eq("id", profileId)
      .single();
    const balance = Number(profile?.wallet_balance ?? 0);
    const newBalance = balance + data.amount;
    await supabaseAdmin.from("profiles").update({ wallet_balance: newBalance }).eq("id", profileId);
    await supabaseAdmin.from("wallet_transactions").insert({
      profile_id: profileId,
      type: "credit",
      amount: data.amount,
      description: "Demo top-up (Flutterwave integration coming soon)",
    });
    await supabaseAdmin.from("notifications").insert({
      profile_id: profileId,
      message: `Wallet topped up with ₦${data.amount.toLocaleString()}. New balance: ₦${newBalance.toLocaleString()}.`,
      channel: "in_app",
      type: "topup",
    });
    return { ok: true, new_balance: newBalance };
  });
