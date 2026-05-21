import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminDeletePromoCode,
  adminListPromoCodes,
  adminUpsertPromoCode,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/promos")({ component: AdminPromos });

type Row = {
  id?: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  min_order_amount: number;
  expiry_date: string | null;
  usage_limit: number | null;
  is_active: boolean;
};

function AdminPromos() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-promos"], queryFn: () => adminListPromoCodes() });
  const [editing, setEditing] = useState<Row | null>(null);

  const save = useMutation({
    mutationFn: (row: Row) => adminUpsertPromoCode({ data: row }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-promos"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminDeletePromoCode({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-promos"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() =>
            setEditing({
              code: "",
              type: "percentage",
              value: 10,
              min_order_amount: 0,
              expiry_date: null,
              usage_limit: null,
              is_active: true,
            })
          }
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          + New promo
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Min order</th>
              <th className="px-4 py-3">Used</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono">{p.code}</td>
                <td className="px-4 py-3">
                  {p.type === "percentage" ? `${p.value}%` : `₦${p.value.toLocaleString()}`}
                </td>
                <td className="px-4 py-3">₦{p.min_order_amount.toLocaleString()}</td>
                <td className="px-4 py-3">
                  {p.times_used}
                  {p.usage_limit != null ? ` / ${p.usage_limit}` : ""}
                </td>
                <td className="px-4 py-3">{p.expiry_date ?? "—"}</td>
                <td className="px-4 py-3">{p.is_active ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing({ ...p })} className="mr-2 text-sm text-primary hover:underline">
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete promo "${p.code}"?`)) remove.mutate(p.id);
                    }}
                    className="text-sm text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lg">
            <h3 className="font-display text-xl">{editing.id ? "Edit promo" : "New promo"}</h3>
            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="text-muted-foreground">Code (A-Z, 0-9)</span>
                <input
                  value={editing.code}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-muted-foreground">Type</span>
                  <select
                    value={editing.type}
                    onChange={(e) => setEditing({ ...editing, type: e.target.value as "percentage" | "fixed" })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed (₦)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-muted-foreground">Value</span>
                  <input
                    type="number"
                    value={editing.value}
                    onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-muted-foreground">Min order (₦)</span>
                <input
                  type="number"
                  value={editing.min_order_amount}
                  onChange={(e) => setEditing({ ...editing, min_order_amount: Number(e.target.value) })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-muted-foreground">Expiry</span>
                  <input
                    type="date"
                    value={editing.expiry_date ?? ""}
                    onChange={(e) => setEditing({ ...editing, expiry_date: e.target.value || null })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="text-muted-foreground">Usage limit</span>
                  <input
                    type="number"
                    value={editing.usage_limit ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, usage_limit: e.target.value ? Number(e.target.value) : null })
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  />
                </label>
              </div>
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
                disabled={save.isPending || !editing.code}
                onClick={() => save.mutate(editing)}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
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
