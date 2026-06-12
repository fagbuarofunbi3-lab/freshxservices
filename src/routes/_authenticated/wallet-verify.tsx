import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { verifyWalletTopUp } from "@/lib/wallet.functions";
import { useInvalidateMe } from "../__root";
import { naira } from "@/lib/format";

// Flutterwave sends transaction_id as a number and may use status values like
// "completed". Coerce everything to strings and never throw on bad input —
// a throw here causes a 500 error page right after payment.
const SearchSchema = z.object({
  status: z.coerce.string().optional(),
  tx_ref: z.coerce.string().optional(),
  transaction_id: z.coerce.string().optional(),
});

export const Route = createFileRoute("/_authenticated/wallet-verify")({
  validateSearch: (s): z.infer<typeof SearchSchema> => {
    const parsed = SearchSchema.safeParse(s);
    return parsed.success ? parsed.data : {};
  },
  component: WalletVerifyPage,
});

function WalletVerifyPage() {
  const search = useSearch({ from: "/_authenticated/wallet-verify" });
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
      if (search.status === "cancelled" || search.status === "failed") {
        setState("cancelled");
        setMessage("Payment was cancelled. No funds were added.");
        return;
      }
      if (!search.transaction_id || !search.tx_ref) {
        setState("error");
        setMessage("Missing transaction details from Flutterwave.");
        return;
      }
      try {
        const res = await verify({
          data: { transaction_id: search.transaction_id, tx_ref: search.tx_ref },
        });
        await Promise.all([invalidateMe(), qc.invalidateQueries({ queryKey: ["wallet-tx"] })]);
        if (res.amount) setAmount(res.amount);
        setState("success");
        setMessage(
          res.already_processed
            ? `This payment was already credited. Balance: ${naira(res.new_balance)}.`
            : `Wallet credited. New balance: ${naira(res.new_balance)}.`,
        );
      } catch (err) {
        setState("error");
        setMessage(err instanceof Error ? err.message : "Verification failed");
      }
    })();
  }, [search, verify, invalidateMe, qc]);

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
