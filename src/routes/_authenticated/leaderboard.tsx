import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Trophy, Medal, Sparkles, ArrowLeft, Copy, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { getReferralLeaderboard } from "@/lib/referrals.functions";


export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["referral-leaderboard"],
    queryFn: () => getReferralLeaderboard(),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </div>

      <section className="glass relative overflow-hidden rounded-2xl p-6 md:p-8">
        <div
          className="freshx-blob"
          style={{ background: "var(--color-primary)", width: 260, height: 260, top: -80, right: -80, opacity: 0.22 }}
        />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Referral Challenge
          </div>
          <h1 className="mt-3 font-display text-3xl md:text-4xl">Top Ambassadors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.period_label ?? "This month"} · Refer more friends, climb the board.
          </p>
          {data?.you ? (
            <div className="mt-4 rounded-xl border border-primary/30 bg-background/70 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Your position</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl">#{data.you.rank}</span>
                <span className="text-sm text-muted-foreground">
                  · {data.you.signups_this_month} sign-up{data.you.signups_this_month === 1 ? "" : "s"} this month
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {data.you.active_users_this_month} of them used a service this month ·{" "}
                {data.you.active_users_total} active all-time
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Your code: <span className="font-mono text-foreground">{data.you.code}</span>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
              You don't have a referral code yet. Ask the admin to assign one so you can join the challenge.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 md:p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Leaderboard</h2>
          <span className="text-xs text-muted-foreground">Ranked by sign-ups this month</span>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !data || data.entries.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No ambassadors on the board yet. Be the first!
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {data.entries.map((e) => (
              <li
                key={e.code}
                className={`flex items-center gap-3 py-3 ${e.is_you ? "rounded-lg bg-primary-soft/60 px-2" : ""}`}
              >
                <RankBadge rank={e.rank} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {e.owner_name}
                    {e.is_you && (
                      <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {e.total_signups} total sign-up{e.total_signups === 1 ? "" : "s"} ·{" "}
                    {e.active_users_this_month} used a service this month
                    <span className="hidden sm:inline"> · {e.active_users_total} active all-time</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-xl leading-none">{e.signups_this_month}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">this month</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-400/20 text-yellow-500">
        <Trophy className="h-4 w-4" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-400/20 text-slate-400">
        <Medal className="h-4 w-4" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-600/20 text-amber-600">
        <Medal className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
      #{rank}
    </div>
  );
}
