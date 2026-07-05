import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFreshXSession } from "@/lib/session.server";

async function requireProfileId(): Promise<string> {
  const session = await getFreshXSession();
  const id = session.data?.profileId;
  if (!id) throw new Error("Not signed in");
  return id;
}

// Create a personal referral code for the current signed-in user if they
// don't have one yet. Idempotent — returns the existing code otherwise.
export const generateMyReferralCode = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ code: string; created: boolean }> => {
    const profileId = await requireProfileId();

    const { data: existing } = await supabaseAdmin
      .from("referral_codes")
      .select("code")
      .eq("owner_profile_id", profileId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.code) return { code: existing.code as string, created: false };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", profileId)
      .maybeSingle();

    const base = ((profile?.full_name as string | undefined) ?? "FRESH")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8) || "FRESH";

    const rand = () => Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z0-9]/g, "0");

    let code = "";
    for (let i = 0; i < 8; i++) {
      const candidate = `${base}${rand()}`;
      const { data: clash } = await supabaseAdmin
        .from("referral_codes")
        .select("id")
        .ilike("code", candidate)
        .maybeSingle();
      if (!clash) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("Could not generate a unique code, please try again");

    const { error } = await supabaseAdmin.from("referral_codes").insert({
      code,
      owner_profile_id: profileId,
      reward_amount: 0,
      is_active: true,
    });
    if (error) throw new Error(error.message);
    return { code, created: true };
  },
);

export type LeaderboardEntry = {
  code: string;
  owner_name: string;
  signups_this_month: number;
  total_signups: number;
  active_users_this_month: number;
  active_users_total: number;
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

    // All profiles referred by any assigned code — used for both sign-up counts
    // and to figure out which referred users have actually placed an order.
    const codeStrings = (codes ?? []).map((c) => (c.code as string).toUpperCase());
    const monthCounts = new Map<string, number>();
    const totalReferredByCode = new Map<string, string[]>(); // code -> profile ids (all-time)
    const monthReferredByCode = new Map<string, string[]>(); // code -> profile ids (this month)

    if (codeStrings.length) {
      const { data: referred } = await supabaseAdmin
        .from("profiles")
        .select("id, referred_by_code, created_at")
        .not("referred_by_code", "is", null);

      const monthStart = start.getTime();
      const monthEnd = end.getTime();
      for (const row of referred ?? []) {
        const raw = (row.referred_by_code as string | null) ?? null;
        if (!raw) continue;
        const key = raw.toUpperCase();
        const pid = row.id as string;
        const created = row.created_at ? new Date(row.created_at as string).getTime() : 0;

        const totalList = totalReferredByCode.get(key) ?? [];
        totalList.push(pid);
        totalReferredByCode.set(key, totalList);

        if (created >= monthStart && created < monthEnd) {
          monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
          const monthList = monthReferredByCode.get(key) ?? [];
          monthList.push(pid);
          monthReferredByCode.set(key, monthList);
        }
      }
    }

    // Distinct profile_ids that have placed at least one order — among all
    // referred users. Used to compute "active users" per referral code.
    const allReferredIds = Array.from(
      new Set(
        Array.from(totalReferredByCode.values()).flat(),
      ),
    );
    const orderingIds = new Set<string>();
    if (allReferredIds.length) {
      const { data: orderRows } = await supabaseAdmin
        .from("orders")
        .select("profile_id")
        .in("profile_id", allReferredIds);
      for (const r of orderRows ?? []) orderingIds.add(r.profile_id as string);
    }

    const rows = (codes ?? [])
      .map((c) => {
        const codeUpper = (c.code as string).toUpperCase();
        const owner_id = c.owner_profile_id as string;
        const totalIds = totalReferredByCode.get(codeUpper) ?? [];
        const monthIds = monthReferredByCode.get(codeUpper) ?? [];
        const active_users_total = totalIds.filter((id) => orderingIds.has(id)).length;
        const active_users_this_month = monthIds.filter((id) => orderingIds.has(id)).length;
        return {
          code: c.code as string,
          owner_name: ownerName.get(owner_id) ?? "Ambassador",
          owner_id,
          signups_this_month: monthCounts.get(codeUpper) ?? 0,
          total_signups: Number(c.times_used ?? 0),
          active_users_this_month,
          active_users_total,
        };
      })
      .sort((a, b) =>
        b.signups_this_month - a.signups_this_month ||
        b.active_users_this_month - a.active_users_this_month ||
        b.total_signups - a.total_signups ||
        a.owner_name.localeCompare(b.owner_name),
      );

    const entries: LeaderboardEntry[] = rows.map((r, i) => ({
      code: r.code,
      owner_name: r.owner_name,
      signups_this_month: r.signups_this_month,
      total_signups: r.total_signups,
      active_users_this_month: r.active_users_this_month,
      active_users_total: r.active_users_total,
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
