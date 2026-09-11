// Server-only Flutterwave Standard checkout helpers. Never import from client code.
import fs from "node:fs";
import path from "node:path";

const FLW_BASE = "https://api.flutterwave.com/v3";

function secretKey(): string {
  let k = process.env.FLUTTERWAVE_SECRET_KEY;
  if (k && k.trim()) return k.trim();

  // In local development, the Node dev server may have started before .env was populated.
  // Fall back to reading .env directly so the developer doesn't have to restart the server.
  if (typeof process !== "undefined" && typeof process.cwd === "function") {
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, "utf-8").split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("FLUTTERWAVE_SECRET_KEY=")) {
            const rawVal = trimmed.slice("FLUTTERWAVE_SECRET_KEY=".length).trim();
            const cleanVal = rawVal.replace(/^["']|["']$/g, "").trim();
            if (cleanVal) {
              process.env.FLUTTERWAVE_SECRET_KEY = cleanVal;
              return cleanVal;
            }
          }
        }
      }
    } catch {
      // Ignore file read errors
    }
  }

  throw new Error("FLUTTERWAVE_SECRET_KEY is not configured");
}

export type FlwInitOptions = {
  tx_ref: string;
  amount: number;
  currency?: string;
  redirect_url: string;
  customer: { email: string; name?: string; phonenumber?: string };
  meta?: Record<string, string | number | null>;
  customizations?: { title?: string; description?: string; logo?: string };
};

export async function initFlutterwavePayment(opts: FlwInitOptions): Promise<{ link: string }> {
  const res = await fetch(`${FLW_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      tx_ref: opts.tx_ref,
      amount: opts.amount,
      currency: opts.currency ?? "NGN",
      redirect_url: opts.redirect_url,
      customer: opts.customer,
      meta: opts.meta ?? {},
      customizations: opts.customizations ?? {
        title: "FreshX Wallet Top-Up",
        description: "Top up your wallet balance",
      },
      payment_options: "card,banktransfer,ussd,account,opay",
    }),
  });
  const json = (await res.json()) as { status: string; message?: string; data?: { link: string } };
  if (json.status !== "success" || !json.data?.link) {
    throw new Error(json.message ?? "Flutterwave init failed");
  }
  return { link: json.data.link };
}

export type FlwVerifyResult = {
  status: "successful" | "failed" | "pending";
  amount: number;
  currency: string;
  tx_ref: string;
  flw_ref: string;
  meta?: Record<string, unknown> | null;
};

export async function verifyFlutterwavePayment(transactionId: string | number): Promise<FlwVerifyResult> {
  const res = await fetch(`${FLW_BASE}/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json()) as {
    status: string;
    message?: string;
    data?: { status: string; amount: number; currency: string; tx_ref: string; flw_ref: string; meta?: Record<string, unknown> | null };
  };
  if (json.status !== "success" || !json.data) {
    throw new Error(json.message ?? "Flutterwave verification failed");
  }
  return {
    status: json.data.status as FlwVerifyResult["status"],
    amount: Number(json.data.amount),
    currency: json.data.currency,
    tx_ref: json.data.tx_ref,
    flw_ref: json.data.flw_ref,
    meta: json.data.meta ?? null,
  };
}

export function getFlutterwaveWebhookHash(): string | undefined {
  let h = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  if (h && h.trim()) return h.trim();

  if (typeof process !== "undefined" && typeof process.cwd === "function") {
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, "utf-8").split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("FLUTTERWAVE_WEBHOOK_HASH=")) {
            const rawVal = trimmed.slice("FLUTTERWAVE_WEBHOOK_HASH=".length).trim();
            const cleanVal = rawVal.replace(/^["']|["']$/g, "").trim();
            if (cleanVal) {
              process.env.FLUTTERWAVE_WEBHOOK_HASH = cleanVal;
              return cleanVal;
            }
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  return undefined;
}

