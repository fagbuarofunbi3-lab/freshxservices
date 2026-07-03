import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFreshXSession } from "@/lib/session.server";

async function requireProfileId(): Promise<string> {
  const session = await getFreshXSession();
  const id = session.data?.profileId;
  if (!id) throw new Error("Not signed in");
  return id;
}

export type LeaderboardEntry = {
  code: string;
  owner_name: string;
  signups_this_month: number;
  total_signups: number;
  is_you: boolean;
  rank: number;
};

export type LeaderboardResult = {
  period_label: string;
  period_start: string;
  period_end: string;
  entries: LeaderboardEntry[];
  you: LeaderboardEntry | null;
  eligible: boolean;
};

// Public leaderboard for the "Referral Challenge" — visible to every signed-in
// user. Only referral codes with an owner (admin-assigned) participate. Ranks
// are based on how many people signed up using each code in the current
// calendar month.
export const getReferralLeaderboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<LeaderboardResult> => {
    const profileId = await requireProfileId();

    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const period_label = start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

    // All active referral codes assigned to a customer
    const { data: codes, error: cErr } = await supabaseAdmin
      .from("referral_codes")
      .select("code, owner_profile_id, times_used, is_active")
      .not("owner_profile_id", "is", null)
      .eq("is_active", true);
    if (cErr) throw new Error(cErr.message);

    const ownerIds = Array.from(new Set((codes ?? []).map((c) => c.owner_profile_id as string)));
    const { data: owners } = ownerIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ownerIds)
      : { data: [] as Array<{ id: string; full_name: string }> };
    const ownerName = new Map((owners ?? []).map((o) => [o.id as string, (o.full_name as string) ?? "Ambassador"]));

    // Count signups in this month per code (uses profiles.referred_by_code)
    const codeStrings = (codes ?? []).map((c) => (c.code as string).toUpperCase());
    const monthCounts = new Map<string, number>();
    if (codeStrings.length) {
      const { data: newSignups } = await supabaseAdmin
        .from("profiles")
        .select("referred_by_code")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .not("referred_by_code", "is", null);
      for (const row of newSignups ?? []) {
        const raw = (row.referred_by_code as string | null) ?? null;
        if (!raw) continue;
        const key = raw.toUpperCase();
        monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
      }
    }

    const rows = (codes ?? [])
      .map((c) => {
        const codeUpper = (c.code as string).toUpperCase();
        const owner_id = c.owner_profile_id as string;
        return {
          code: c.code as string,
          owner_name: ownerName.get(owner_id) ?? "Ambassador",
          owner_id,
          signups_this_month: monthCounts.get(codeUpper) ?? 0,
          total_signups: Number(c.times_used ?? 0),
        };
      })
      .sort((a, b) =>
        b.signups_this_month - a.signups_this_month ||
        b.total_signups - a.total_signups ||
        a.owner_name.localeCompare(b.owner_name),
      );

    const entries: LeaderboardEntry[] = rows.map((r, i) => ({
      code: r.code,
      owner_name: r.owner_name,
      signups_this_month: r.signups_this_month,
      total_signups: r.total_signups,
      is_you: r.owner_id === profileId,
      rank: i + 1,
    }));

    const you = entries.find((e) => e.is_you) ?? null;

    return {
      period_label,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      entries,
      you,
      eligible: !!you,
    };
  },
);
