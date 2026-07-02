import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  adminCreditWallet,
  adminGetCustomerPromo,
  adminListCustomers,
  adminUpsertCustomerPromo,
  adminGetCustomerReferral,
  adminUpsertCustomerReferral,
} from "@/lib/admin.functions";
import { naira } from "@/lib/format";


export const Route = createFileRoute("/_authenticated/admin/customers")({ component: AdminCustomers });

function AdminCustomers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data } = useQuery({ queryKey: ["admin-customers"], queryFn: () => adminListCustomers() });
  const [adjusting, setAdjusting] = useState<{ id: string; name: string; balance: number } | null>(null);
  const [promoFor, setPromoFor] = useState<{ id: string; name: string } | null>(null);
  const [referralFor, setReferralFor] = useState<{ id: string; name: string } | null>(null);
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl">Customers</h2>
        <div className="rounded-full border border-border bg-primary-soft/40 px-3 py-1 text-sm">
          <span className="text-muted-foreground">Total users:</span>{" "}
          <span className="font-semibold">{data?.length ?? 0}</span>
        </div>
      </div>

      <input
        placeholder="Search by name or WhatsApp number"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />


      <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3">Wallet</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3">{c.full_name}</td>
                <td className="px-4 py-3">{c.whatsapp_number}</td>
                <td className="px-4 py-3">{naira(c.wallet_balance)}</td>
                <td className="px-4 py-3 capitalize">{c.role}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => setAdjusting({ id: c.id, name: c.full_name, balance: c.wallet_balance })}
                    className="text-sm text-primary hover:underline"
                  >
                    Adjust wallet
                  </button>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <button
                    onClick={() => setPromoFor({ id: c.id, name: c.full_name })}
                    className="text-sm text-primary hover:underline"
                  >
                    Promo code
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

      {promoFor && (
        <PromoCodeModal
          profileId={promoFor.id}
          name={promoFor.name}
          onClose={() => setPromoFor(null)}
        />
      )}
    </div>
  );
}

function PromoCodeModal({
  profileId,
  name,
  onClose,
}: {
  profileId: string;
  name: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: existing, isLoading } = useQuery({
    queryKey: ["admin-customer-promo", profileId],
    queryFn: () => adminGetCustomerPromo({ data: { owner_profile_id: profileId } }),
  });
  const [code, setCode] = useState("");
  const [percentage, setPercentage] = useState<number>(5);
  const [isActive, setIsActive] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate fields when we receive existing data
  if (existing && !hydrated) {
    setCode(existing.code);
    setPercentage(existing.percentage);
    setIsActive(existing.is_active);
    setHydrated(true);
  }

  const save = useMutation({
    mutationFn: (vars: { code: string; percentage: number; is_active: boolean }) =>
      adminUpsertCustomerPromo({
        data: {
          owner_profile_id: profileId,
          code: vars.code,
          percentage: vars.percentage,
          is_active: vars.is_active,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-customer-promo", profileId] });
      toast.success("Promo code saved");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suggested = name
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .join("")
    .slice(0, 12)
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lg">
        <h3 className="font-display text-xl">Promo code for {name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {existing
            ? `Used ${existing.times_used} time${existing.times_used === 1 ? "" : "s"}. Edit and save to update.`
            : "Create a personal referral code this customer can share. When someone else uses it on a wallet top-up, they get the discount and this customer earns the same amount as wallet commission."}
        </p>

        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-4 space-y-3 text-sm">
            <label className="block">
              <span className="text-muted-foreground">Code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                placeholder={suggested || "EG: FUNBI5"}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono tracking-wider"
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground">Discount percentage (1–50%)</span>
              <input
                type="number"
                min={1}
                max={50}
                value={percentage}
                onChange={(e) => setPercentage(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Example: at 5%, someone topping up ₦10,000 pays ₦9,500 and {name} earns ₦500.
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>Active</span>
            </label>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            disabled={save.isPending || code.length < 3 || percentage < 1 || percentage > 50}
            onClick={() => save.mutate({ code, percentage, is_active: isActive })}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Save promo
          </button>
        </div>
      </div>
    </div>
  );
}
