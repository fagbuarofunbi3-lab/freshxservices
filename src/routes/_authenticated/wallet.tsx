import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { initWalletTopUp, listTransactions, previewTopUpPromo } from "@/lib/wallet.functions";
import { useMe, useInvalidateMe } from "../__root";
import { naira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/wallet")({ component: WalletPage });

function WalletPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const invalidateMe = useInvalidateMe();
  const initTopUp = useServerFn(initWalletTopUp);
  const previewPromo = useServerFn(previewTopUpPromo);
  const { data: txs } = useQuery({
    queryKey: ["wallet-tx"],
    queryFn: () => listTransactions(),
  });
  const [amount, setAmount] = useState(2000);
  const [email, setEmail] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<
    null | { code: string; percentage: number; discount: number; charged_amount: number }
  >(null);
  const [loading, setLoading] = useState(false);

  async function onApplyPromo() {
    if (!promoCode.trim()) return;
    if (amount < 500) return toast.error("Enter your top-up amount first (min ₦500)");
    try {
      const res = await previewPromo({ data: { code: promoCode.trim(), amount } });
      if (!res.ok || !res.code) {
        setPromoApplied(null);
        toast.error(res.message ?? "Promo code could not be applied.");
        return;
      }
      setPromoApplied({
        code: res.code,
        percentage: res.percentage,
        discount: res.discount,
        charged_amount: res.charged_amount,
      });
      toast.success(`Promo applied — you save ${naira(res.discount)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not validate promo code");
    }
  }

  function clearPromo() {
    setPromoApplied(null);
    setPromoCode("");
  }

  async function onTopUp() {
    if (amount < 500) return toast.error("Minimum top-up is ₦500");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return toast.error("Enter the email to receive your payment receipt");
    setLoading(true);
    try {
      const res = await initTopUp({
        data: {
          amount,
          email,
          promo_code: promoApplied?.code ?? undefined,
        },
      });
      await Promise.all([invalidateMe(), qc.invalidateQueries({ queryKey: ["wallet-tx"] })]);
      window.location.href = res.payment_link;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start payment");
      setLoading(false);
    }
  }

  const payNow = promoApplied ? promoApplied.charged_amount : amount;

  return (
    <div className="space-y-6">
      <section className="glass rounded-2xl p-6 md:p-8">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Wallet balance</div>
        <div className="mt-2 font-display text-5xl">{naira(me?.wallet_balance ?? 0)}</div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-xl">Top up your wallet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay securely with card, bank transfer, USSD or Opay through Flutterwave.
          Funds appear in your wallet immediately after payment.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {[1000, 2000, 5000, 10000].map((v) => (
            <button
              key={v}
              onClick={() => {
                setAmount(v);
                if (promoApplied) setPromoApplied(null);
              }}
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
              setAmount(Number(e.target.value));
              if (promoApplied) setPromoApplied(null);
            }}
            className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Email for receipt
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Promo / referral code (optional)
          </span>
          <div className="mt-1 flex max-w-sm gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              disabled={!!promoApplied}
              placeholder="EG: FUNBI5"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono uppercase tracking-wider disabled:opacity-60"
            />
            {promoApplied ? (
              <button
                onClick={clearPromo}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                Remove
              </button>
            ) : (
              <button
                onClick={onApplyPromo}
                disabled={!promoCode.trim()}
                className="rounded-md border border-primary bg-primary-soft px-3 py-2 text-sm font-medium text-primary disabled:opacity-50"
              >
                Apply
              </button>
            )}
          </div>
          {promoApplied && (
            <div className="mt-2 rounded-md bg-success/10 px-3 py-2 text-xs text-success">
              ✓ Code <b>{promoApplied.code}</b> applied — {promoApplied.percentage}% off. You save{" "}
              {naira(promoApplied.discount)}.
            </div>
          )}
        </div>

        {promoApplied && (
          <div className="mt-4 max-w-sm rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between"><span>Top-up</span><span>{naira(amount)}</span></div>
            <div className="flex justify-between text-success">
              <span>Discount ({promoApplied.percentage}%)</span>
              <span>−{naira(promoApplied.discount)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold">
              <span>You pay</span><span>{naira(payNow)}</span>
            </div>
          </div>
        )}

        <button
          onClick={onTopUp}
          disabled={loading}
          className="mt-5 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Redirecting…" : `Pay ${naira(payNow)} with Flutterwave`}
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
