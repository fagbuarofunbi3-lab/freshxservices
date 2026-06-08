import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { adminCreditWallet, adminListCustomers } from "@/lib/admin.functions";
import { naira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/customers")({ component: AdminCustomers });

function AdminCustomers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data } = useQuery({ queryKey: ["admin-customers"], queryFn: () => adminListCustomers() });
  const [adjusting, setAdjusting] = useState<{ id: string; name: string; balance: number } | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const credit = useMutation({
    mutationFn: (vars: { profile_id: string; amount: number; note?: string }) =>
      adminCreditWallet({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      setAdjusting(null);
      setAmount("");
      setNote("");
      toast.success("Wallet adjusted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter(
      (c) => c.full_name.toLowerCase().includes(q) || c.whatsapp_number.includes(q),
    );
  }, [data, search]);

  return (
    <div className="space-y-4">
      <input
        placeholder="Search by name or WhatsApp number"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />

      <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3">Wallet</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3">{c.full_name}</td>
                <td className="px-4 py-3">{c.whatsapp_number}</td>
                <td className="px-4 py-3">{naira(c.wallet_balance)}</td>
                <td className="px-4 py-3 capitalize">{c.role}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setAdjusting({ id: c.id, name: c.full_name, balance: c.wallet_balance })}
                    className="text-sm text-primary hover:underline"
                  >
                    Adjust wallet
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adjusting && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lg">
            <h3 className="font-display text-xl">Adjust wallet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {adjusting.name} · current balance {naira(adjusting.balance)}
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="text-muted-foreground">Amount (₦) — use negative to debit</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  placeholder="e.g. 2000 or -500"
                />
              </label>
              <label className="block">
                <span className="text-muted-foreground">Note (optional)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  placeholder="e.g. Refund for damaged item"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setAdjusting(null)}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={credit.isPending || !amount || Number(amount) === 0}
                onClick={() =>
                  credit.mutate({
                    profile_id: adjusting.id,
                    amount: Math.round(Number(amount)),
                    note: note || undefined,
                  })
                }
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
