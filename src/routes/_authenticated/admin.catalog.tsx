import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminDeleteServiceItem,
  adminListServiceItems,
  adminUpsertServiceItem,
} from "@/lib/admin.functions";
import { naira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/catalog")({ component: AdminCatalog });

type Row = { id?: string; category: "laundry" | "cleaning"; name: string; price: number; is_active: boolean };

function AdminCatalog() {
  const qc = useQueryClient();
  const { data: items } = useQuery({ queryKey: ["admin-catalog"], queryFn: () => adminListServiceItems() });
  const [editing, setEditing] = useState<Row | null>(null);

  const save = useMutation({
    mutationFn: (row: Row) => adminUpsertServiceItem({ data: row }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-catalog"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminDeleteServiceItem({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-catalog"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing({ category: "laundry", name: "", price: 0, is_active: true })}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          + New item
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="px-4 py-3 capitalize">{i.category}</td>
                <td className="px-4 py-3">{i.name}</td>
                <td className="px-4 py-3">{naira(i.price)}</td>
                <td className="px-4 py-3">{i.is_active ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setEditing({ ...i, category: i.category as "laundry" | "cleaning" })}
                    className="mr-2 text-sm text-primary hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${i.name}"?`)) remove.mutate(i.id);
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
            <h3 className="font-display text-xl">{editing.id ? "Edit item" : "New item"}</h3>
            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="text-muted-foreground">Category</span>
                <select
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value as "laundry" | "cleaning" })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="laundry">Laundry</option>
                  <option value="cleaning">Cleaning</option>
                </select>
              </label>
              <label className="block">
                <span className="text-muted-foreground">Name</span>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-muted-foreground">Price (₦)</span>
                <input
                  type="number"
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
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
                disabled={save.isPending || !editing.name}
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
