import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trophy, Medal, Sparkles, ArrowLeft, Copy, Share2, Check, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { getReferralLeaderboard, generateMyReferralCode } from "@/lib/referrals.functions";


export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["referral-leaderboard"],
    queryFn: () => getReferralLeaderboard(),
    refetchInterval: 30_000,
  });
  const generate = useMutation({
    mutationFn: () => generateMyReferralCode(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["referral-leaderboard"] });
      toast.success(res.created ? `Your code ${res.code} is ready!` : `Your code is ${res.code}`);
    },
    onError: (e: Error) => toast.error(e.message),
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

      {data?.you ? <ShareLinkCard code={data.you.code} /> : null}



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

function ShareLinkCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://freshxservices.com.ng";
  const url = `${origin}/r/${code}`;
  const shareText = `Get fresh laundry & cleaning delivered by FreshX. Sign up with my code ${code}: ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy — long-press the link to copy");
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "FreshX", text: shareText, url });
        return;
      } catch {
        // user cancelled — fall through to WhatsApp
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Share2 className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg">Your FreshX referral link</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Share this link on WhatsApp. Every friend who signs up counts toward your rank.
      </p>
      <div className="mt-3 flex items-stretch overflow-hidden rounded-md border border-border bg-background">
        <div className="min-w-0 flex-1 truncate px-3 py-2.5 font-mono text-xs">{url}</div>
        <button
          onClick={copy}
          className="flex items-center gap-1 border-l border-border bg-muted/50 px-3 text-xs font-medium hover:bg-muted"
          aria-label="Copy link"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <button
        onClick={share}
        className="mt-3 w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        Share on WhatsApp
      </button>
    </section>
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
