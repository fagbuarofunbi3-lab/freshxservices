// Server-only Flutterwave Standard checkout helpers. Never import from client code.

const FLW_BASE = "https://api.flutterwave.com/v3";

function secretKey(): string {
  const k = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!k) throw new Error("FLUTTERWAVE_SECRET_KEY is not configured");
  return k;
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
};

export async function verifyFlutterwavePayment(transactionId: string | number): Promise<FlwVerifyResult> {
  const res = await fetch(`${FLW_BASE}/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  const json = (await res.json()) as {
    status: string;
    message?: string;
    data?: { status: string; amount: number; currency: string; tx_ref: string; flw_ref: string };
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
  };
}
