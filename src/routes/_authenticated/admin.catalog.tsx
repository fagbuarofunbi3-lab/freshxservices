import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminDeleteServiceItem,
  adminListServiceItems,
  adminUpsertServiceItem,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/catalog")({ component: AdminCatalog });

const CATEGORY_OPTIONS = [
  { value: "laundry_soft", label: "Laundry · Soft Clothes" },
  { value: "laundry_hard", label: "Laundry · Hard Clothes" },
  { value: "laundry_bedding", label: "Laundry · Bedding & Home" },
  { value: "cleaning_apartment", label: "Cleaning · Apartment" },
  { value: "cleaning_office", label: "Cleaning · Office" },
  { value: "cleaning_other", label: "Cleaning · Other" },
  { value: "delivery", label: "Delivery fee" },
] as const;

type CategoryValue = (typeof CATEGORY_OPTIONS)[number]["value"];

type Row = {
  id?: string;
  category: CategoryValue;
  name: string;
  price: number;
  is_active: boolean;
};

const emptyRow: Row = { category: "laundry_soft", name: "", price: 0, is_active: true };

function EditableServiceItem({
  row,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  row: Row;
  onSave: (row: Row) => void;
  onDelete?: (id: string, name: string) => void;
  saving: boolean;
  deleting?: boolean;
}) {
  const [draft, setDraft] = useState<Row>(row);

  useEffect(() => {
    setDraft(row);
  }, [row]);

  const canSave = draft.name.trim().length > 0 && Number.isFinite(draft.price) && draft.price >= 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1.2fr_1.2fr_0.7fr_auto] md:items-end">
        <label className="block text-sm font-medium">
          <span className="text-muted-foreground">Category</span>
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value as CategoryValue })}
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground outline-none focus:border-primary sm:text-sm"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          <span className="text-muted-foreground">Name</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Shirt, Duvet, Apartment cleaning"
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground outline-none focus:border-primary sm:text-sm"
          />
        </label>

        <label className="block text-sm font-medium">
          <span className="text-muted-foreground">Price (₦)</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground outline-none focus:border-primary sm:text-sm"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => onSave({ ...draft, name: draft.name.trim() })}
            className="min-h-11 flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60 md:flex-none"
          >
            {saving ? "Saving..." : row.id ? "Save changes" : "Add item"}
          </button>
          {row.id && onDelete && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => onDelete(row.id!, row.name)}
              className="min-h-11 rounded-md border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <label className="mt-3 flex w-fit items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={draft.is_active}
          onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
          className="h-4 w-4 accent-primary"
        />
        Show this item to customers
      </label>
    </div>
  );
}

function AdminCatalog() {
  const qc = useQueryClient();
  const {
    data: items,
    isLoading,
    isError,
    error,
  } = useQuery({ queryKey: ["admin-catalog"], queryFn: () => adminListServiceItems() });
  const [newItem, setNewItem] = useState<Row>(() => ({ ...emptyRow }));
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | CategoryValue>("all");

  const filteredItems = (items ?? []).filter((it) => {
    if (categoryFilter !== "all" && it.category !== categoryFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q);
  });

  const save = useMutation({
    mutationFn: (row: Row) => adminUpsertServiceItem({ data: row }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-catalog"] });
      setNewItem({ ...emptyRow });
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
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="font-display text-2xl">Edit prices & categories</h2>
        <p className="text-sm text-muted-foreground">
          Change the category, name, price and visibility directly on this page.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Add a new price</h3>
        </div>
        <EditableServiceItem
          row={newItem}
          onSave={(row) => save.mutate(row)}
          saving={save.isPending && !save.variables?.id}
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">
              Current prices
            </h3>
            <p className="text-xs text-muted-foreground">
              Each service below is editable immediately. Press “Save changes” after any change.
            </p>
          </div>
          {items?.length ? (
            <span className="text-sm text-muted-foreground">
              {filteredItems.length} of {items.length} items
            </span>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_240px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by item name or category…"
            className="min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as "all" | CategoryValue)}
            className="min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">All categories</option>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {isLoading && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Loading prices...
          </div>
        )}
        {isError && (
          <div className="rounded-lg border border-destructive/40 bg-card p-4 text-sm text-destructive">
            {error.message}
          </div>
        )}
        {!isLoading && !isError && !items?.length && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            No prices have been added yet.
          </div>
        )}
        {!isLoading && !isError && items?.length && filteredItems.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            No items match your search.
          </div>
        )}
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <EditableServiceItem
              key={item.id}
              row={{ ...item, category: item.category as CategoryValue }}
              saving={save.isPending && save.variables?.id === item.id}
              deleting={remove.isPending && remove.variables === item.id}
              onSave={(row) => save.mutate(row)}
              onDelete={(id, name) => {
                if (confirm(`Delete "${name}"?`)) remove.mutate(id);
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
