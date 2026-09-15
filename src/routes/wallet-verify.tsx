import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@/lib/create-fn";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { verifyWalletTopUp } from "@/lib/wallet.functions";
import { useInvalidateMe } from "./__root";
import { naira } from "@/lib/format";

// Flutterwave sends transaction_id as a number and may use status values like
// "completed". Coerce everything to strings and never throw on bad input —
// a throw here causes a 500 error page right after payment.
const SearchSchema = z.object({
  status: z.coerce.string().optional(),
  tx_ref: z.coerce.string().optional(),
  txRef: z.coerce.string().optional(),
  transaction_id: z.coerce.string().optional(),
  id: z.coerce.string().optional(),
});

export const Route = createFileRoute("/wallet-verify")({
  validateSearch: (s): z.infer<typeof SearchSchema> => {
    const parsed = SearchSchema.safeParse(s);
    return parsed.success ? parsed.data : {};
  },
  component: WalletVerifyPage,
});

function WalletVerifyPage() {
  const search = useSearch({ from: "/wallet-verify" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const invalidateMe = useInvalidateMe();
  const verify = useServerFn(verifyWalletTopUp);
  const [state, setState] = useState<"loading" | "success" | "error" | "cancelled">("loading");
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      const status = (search.status || "").toLowerCase();
      const txRef = search.tx_ref || search.txRef;
      const txId = search.transaction_id || search.id;

      if (status === "cancelled" || status === "failed") {
        setState("cancelled");
        setMessage("Payment was cancelled. No funds were added.");
        return;
      }
      if (!txId || !txRef) {
        setState("error");
        setMessage("Missing transaction details from Flutterwave.");
        return;
      }
      // Retry a couple of times — Flutterwave can take a moment to settle.
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await verify({
            data: { transaction_id: String(txId), tx_ref: String(txRef) },
          });
          await Promise.all([invalidateMe(), qc.invalidateQueries({ queryKey: ["wallet-tx"] })]);
          if (res.amount) setAmount(res.amount);
          setState("success");
          setMessage(
            res.already_processed
              ? `This payment was already credited. Balance: ${naira(res.new_balance)}.`
              : `Wallet credited. New balance: ${naira(res.new_balance)}.`,
          );
          // Take the user straight back to their dashboard with the new balance.
          setTimeout(() => navigate({ to: "/dashboard", replace: true }), 1200);
          return;
        } catch (err) {
          lastErr = err;
          // Don't retry definitive failures (cancelled/failed payments).
          const msg = err instanceof Error ? err.message : "";
          if (/cancelled|failed|mismatch|currency/i.test(msg)) break;
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      setState("error");
      setMessage(lastErr instanceof Error ? lastErr.message : "Verification failed");
    })();
  }, [search, verify, invalidateMe, qc, navigate]);

  return (
    <div className="mx-auto max-w-md py-12">
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        {state === "loading" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h1 className="mt-4 font-display text-xl">Confirming your payment…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Please don't close this page.</p>
          </>
        )}
        {state === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <h1 className="mt-4 font-display text-2xl">Payment successful</h1>
            {amount && <p className="mt-2 text-3xl font-display">+{naira(amount)}</p>}
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <button
              onClick={() => navigate({ to: "/wallet" })}
              className="mt-6 w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Back to wallet
            </button>
          </>
        )}
        {(state === "error" || state === "cancelled") && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="mt-4 font-display text-2xl">
              {state === "cancelled" ? "Payment cancelled" : "Could not verify payment"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <button
              onClick={() => navigate({ to: "/wallet" })}
              className="mt-6 w-full rounded-md border border-border py-2.5 text-sm font-semibold"
            >
              Back to wallet
            </button>
          </>
        )}
      </div>
    </div>
  );
}
