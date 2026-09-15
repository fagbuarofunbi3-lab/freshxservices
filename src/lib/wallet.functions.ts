import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import { createFn } from "@/lib/create-fn";

export const listTransactions = createFn({ method: "GET" }).handler(async () => {
  const data = await apiClient.get<any[]>("/api/wallet/transactions");
  return (data ?? []).map((r) => ({
    id: (r.id || r._id) as string,
    type: r.type as "credit" | "debit",
    amount: Number(r.amount),
    description: (r.description as string | null) ?? "",
    order_id: (r.order_id as string | null) ?? null,
    created_at: (r.created_at as string) ?? new Date().toISOString(),
  }));
});

export const previewTopUpPromo = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        code: z.string().trim().min(1).max(40),
        amount: z.number().int().min(500).max(1_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const res = await apiClient.post<{
        ok: boolean;
        discount?: number;
        code?: string;
        message?: string;
      }>("/api/promo/apply", {
        code: data.code.toUpperCase(),
        subtotal: data.amount,
      });

      if (!res.ok) {
        return {
          ok: false,
          message: res.message || "Promo code not found or inactive.",
          code: null,
          percentage: 0,
          discount: 0,
          charged_amount: data.amount,
        };
      }

      const discount = Number(res.discount ?? 0);
      const charged = Math.max(100, data.amount - discount);
      return {
        ok: true,
        message: null,
        code: res.code ?? data.code.toUpperCase(),
        percentage: Math.round((discount / data.amount) * 100),
        discount,
        charged_amount: charged,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: err?.message || "Could not validate promo code.",
        code: null,
        percentage: 0,
        discount: 0,
        charged_amount: data.amount,
      };
    }
  });

export const initWalletTopUp = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        amount: z.number().int().min(500).max(1_000_000),
        email: z.string().email().max(200),
        promo_code: z.string().trim().min(1).max(40).optional(),
        redirect_url: z.string().url().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    let redirect_url = data.redirect_url;
    if (!redirect_url) {
      if (typeof window !== "undefined") {
        redirect_url = `${window.location.origin}/wallet-verify`;
      } else {
        redirect_url = "https://freshxservices.com.ng/wallet-verify";
      }
    }

    const res = await apiClient.post<{
      ok: boolean;
      payment_link: string;
      tx_ref: string;
    }>("/api/wallet/topup/init", {
      amount: data.amount,
      email: data.email,
      redirect_url,
      promo_code: data.promo_code,
    });

    return {
      ok: true,
      payment_link: res.payment_link,
      tx_ref: res.tx_ref,
      charged_amount: data.amount,
      discount: 0,
      promo_code: data.promo_code ?? null,
    };
  });

export const verifyWalletTopUp = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        transaction_id: z.string().min(1).max(100),
        tx_ref: z.string().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const res = await apiClient.post<{
      ok: boolean;
      already_processed?: boolean;
      new_balance: number;
      amount: number;
    }>("/api/wallet/topup/verify", {
      transaction_id: data.transaction_id,
      tx_ref: data.tx_ref,
    });

    return {
      ok: true,
      already_processed: !!res.already_processed,
      new_balance: res.new_balance,
      amount: res.amount,
    };
  });
