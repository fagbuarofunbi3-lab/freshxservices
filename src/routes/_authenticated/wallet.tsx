import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listTransactions, topUpStub } from "@/lib/wallet.functions";
import { useMe, useInvalidateMe } from "../__root";
import { naira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/wallet")({ component: WalletPage });

function WalletPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const invalidateMe = useInvalidateMe();
  const topUp = useServerFn(topUpStub);
  const { data: txs } = useQuery({
    queryKey: ["wallet-tx"],
    queryFn: () => listTransactions(),
  });
  const [amount, setAmount] = useState(2000);
  const [loading, setLoading] = useState(false);

  async function onTopUp() {
    if (amount < 500) return toast.error("Minimum top-up is ₦500");
    setLoading(true);
    try {
      await topUp({ data: { amount } });
      await Promise.all([invalidateMe(), qc.invalidateQueries({ queryKey: ["wallet-tx"] })]);
      toast.success(`Wallet topped up with ${naira(amount)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Top-up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass rounded-2xl p-6 md:p-8">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Wallet balance</div>
        <div className="mt-2 font-display text-5xl">{naira(me?.wallet_balance ?? 0)}</div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-xl">Demo top-up</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Real Flutterwave checkout is wired in Phase 3. For now this credits your wallet instantly so you can try the flow.
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
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={onTopUp}
            disabled={loading}
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Adding…" : "Add to wallet"}
          </button>
        </div>
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
