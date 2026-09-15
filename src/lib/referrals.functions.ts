import { createServerFn } from "@tanstack/react-start";
import { apiClient } from "@/lib/api-client";

export const generateMyReferralCode = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ code: string; created: boolean }> => {
    const res = await apiClient.post<{ code: string; created: boolean }>("/api/referrals/my-code");
    return res;
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

export const getReferralLeaderboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<LeaderboardResult> => {
    const res = await apiClient.get<LeaderboardResult>("/api/referrals/leaderboard");
    return res;
  },
);
