import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/create-fn";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { initWalletTopUp, listTransactions } from "@/lib/wallet.functions";
import { useMe, useInvalidateMe } from "../__root";
import { naira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/wallet")({ component: WalletPage });

function WalletPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const invalidateMe = useInvalidateMe();
  const initTopUp = useServerFn(initWalletTopUp);
  const { data: txs } = useQuery({
    queryKey: ["wallet-tx"],
    queryFn: () => listTransactions(),
  });
  const [amount, setAmount] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  // If user navigates back from payment, unfreeze button
  useEffect(() => {
    const onFocus = () => setLoading(false);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem("freshx.hideBalance");
      if (v === "1") setShowBalance(false);
    } catch { /* noop */ }
  }, []);

  function toggleBalance() {
    setShowBalance((prev) => {
      const next = !prev;
      try { localStorage.setItem("freshx.hideBalance", next ? "0" : "1"); } catch { /* noop */ }
      return next;
    });
  }

  async function onTopUp() {
    const amt = typeof amount === "number" ? amount : Number(amount);
    if (!amt || amt < 500) return toast.error("Minimum top-up is ₦500");
    const targetEmail = me?.email?.trim();
    if (!targetEmail)
      return toast.error("No email on your account — add one in Settings first");
    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/wallet-verify`;
      const res = await initTopUp({
        data: {
          amount: amt,
          email: targetEmail,
          redirect_url: redirectUrl,
        },
      });
      // Fire cache invalidations without blocking redirect
      invalidateMe();
      qc.invalidateQueries({ queryKey: ["wallet-tx"] });

      if (res.payment_link) {
        window.location.href = res.payment_link;
      } else {
        throw new Error("No payment link returned by payment provider");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start payment");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass rounded-2xl p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Wallet balance</div>
          <button
            type="button"
            onClick={toggleBalance}
            aria-label={showBalance ? "Hide balance" : "Show balance"}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          >
            {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-2 font-display text-5xl">
          {showBalance ? naira(me?.wallet_balance ?? 0) : "•••••"}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-xl">Top up your wallet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay securely with card, bank transfer, USSD or Opay.
          Funds appear in your wallet immediately after payment.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {[1000, 2000, 5000, 10000].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className={`rounded-md border px-4 py-2 text-sm font-medium ${
                amount === v ? "border-primary bg-primary-soft text-primary" : "border-border"
              }`}
            >
              {naira(v)}
            </button>
          ))}
          <input
            type="number"
            min={500}
            value={amount}
            onChange={(e) => {
              const v = e.target.value;
              setAmount(v === "" ? "" : Number(v));
            }}
            placeholder="Enter amount"
            className="w-36 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Have a promo code? Enter it when you place a laundry order — not here.
        </p>

        <button
          onClick={onTopUp}
          disabled={loading}
          className="mt-5 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Redirecting…" : "Pay"}
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-xl">Transactions</h2>
        {(!txs || txs.length === 0) ? (
          <div className="mt-4 text-sm text-muted-foreground">No transactions yet.</div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {txs.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">{t.description || (t.type === "credit" ? "Top-up" : "Order")}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div
                  className={`font-display text-base ${
                    t.type === "credit" ? "text-success" : "text-destructive"
                  }`}
                >
                  {t.type === "credit" ? "+" : "−"}
                  {naira(t.amount)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
