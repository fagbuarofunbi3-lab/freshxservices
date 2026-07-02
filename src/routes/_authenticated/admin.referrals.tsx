import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  adminDeleteReferralCode,
  adminListReferralCodes,
  adminUpsertReferralCode,
  adminListCustomers,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/referrals")({
  component: AdminReferrals,
});

type Row = {
  id?: string;
  code: string;
  owner_profile_id: string | null;
  reward_amount: number;
  is_active: boolean;
};

function AdminReferrals() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-referrals"],
    queryFn: () => adminListReferralCodes(),
  });
  const { data: customers } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: () => adminListCustomers(),
  });
  const [editing, setEditing] = useState<Row | null>(null);

  const save = useMutation({
    mutationFn: (row: Row) => adminUpsertReferralCode({ data: row }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-referrals"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminDeleteReferralCode({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-referrals"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalUses = useMemo(
    () => (data ?? []).reduce((s, r) => s + r.times_used, 0),
    [data],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl">Referral codes</h2>
          <p className="text-xs text-muted-foreground">
            Codes new users can enter at sign up. Track usage per customer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-border bg-primary-soft/40 px-3 py-1 text-sm">
            <span className="text-muted-foreground">Total signups via referral:</span>{" "}
            <span className="font-semibold">{totalUses}</span>
          </div>
          <button
            onClick={() =>
              setEditing({
                code: "",
                owner_profile_id: null,
                reward_amount: 0,
                is_active: true,
              })
            }
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            + New referral code
          </button>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Reward (₦)</th>
              <th className="px-4 py-3">Times used</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono">{r.code}</td>
                <td className="px-4 py-3">{r.owner_name ?? "—"}</td>
                <td className="px-4 py-3">₦{r.reward_amount.toLocaleString()}</td>
                <td className="px-4 py-3">{r.times_used}</td>
                <td className="px-4 py-3">{r.is_active ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() =>
                      setEditing({
                        id: r.id,
                        code: r.code,
                        owner_profile_id: r.owner_profile_id,
                        reward_amount: r.reward_amount,
                        is_active: r.is_active,
                      })
                    }
                    className="mr-2 text-sm text-primary hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete referral code "${r.code}"?`)) remove.mutate(r.id);
                    }}
                    className="text-sm text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No referral codes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lg">
            <h3 className="font-display text-xl">
              {editing.id ? "Edit referral code" : "New referral code"}
            </h3>
            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="text-muted-foreground">Code (A-Z, 0-9)</span>
                <input
                  value={editing.code}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                    })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono"
                />
              </label>
              <label className="block">
                <span className="text-muted-foreground">Owner (customer)</span>
                <select
                  value={editing.owner_profile_id ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, owner_profile_id: e.target.value || null })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="">— None —</option>
                  {(customers ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} · {c.whatsapp_number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-muted-foreground">Reward per signup (₦)</span>
                <input
                  type="number"
                  min={0}
                  value={editing.reward_amount}
                  onChange={(e) =>
                    setEditing({ ...editing, reward_amount: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                />
                <span>Active</span>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={save.isPending || editing.code.length < 3}
                onClick={() => save.mutate(editing)}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
