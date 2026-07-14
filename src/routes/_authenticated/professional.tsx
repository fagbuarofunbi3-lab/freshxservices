import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Share2, Trash2 } from "lucide-react";
import {
  deleteMyCatalogItem,
  getMyProfessional,
  PRO_CATEGORIES,
  updateMyProfessional,
  upsertMyCatalogItem,
} from "@/lib/professionals.functions";

export const Route = createFileRoute("/_authenticated/professional")({
  component: ProfessionalDashboard,
});

type Item = {
  id?: string;
  image_url: string;
  title: string;
  price: number;
  position: number;
};

function ProfessionalDashboard() {
  const qc = useQueryClient();
  const { data: pro, isLoading } = useQuery({
    queryKey: ["my-professional"],
    queryFn: () => getMyProfessional(),
  });

  const [businessName, setBusinessName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState<Item>({ image_url: "", title: "", price: 0, position: 0 });

  useEffect(() => {
    if (pro && !hydrated) {
      setBusinessName(pro.business_name);
      setWhatsapp(pro.whatsapp_number);
      setIsActive(pro.is_active);
      setHydrated(true);
    }
  }, [pro, hydrated]);

  const saveProfile = useMutation({
    mutationFn: () =>
      updateMyProfessional({
        data: { business_name: businessName, whatsapp_number: whatsapp, is_active: isActive },
      }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["my-professional"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upsertItem = useMutation({
    mutationFn: (row: Item) => upsertMyCatalogItem({ data: row }),
    onSuccess: () => {
      toast.success("Saved");
      setDraft({ image_url: "", title: "", price: 0, position: 0 });
      qc.invalidateQueries({ queryKey: ["my-professional"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => deleteMyCatalogItem({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-professional"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  if (!pro) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h1 className="font-display text-2xl">FreshX Professionals</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are not a FreshX Professional yet. Ask an admin to promote your account so you can
          set up your shop.
        </p>
      </div>
    );
  }

  const shopUrl =
    typeof window !== "undefined" ? `${window.location.origin}/shop/${pro.slug}` : `/shop/${pro.slug}`;

  const categoryLabel =
    PRO_CATEGORIES.find((c) => c.value === pro.category)?.label ?? pro.category;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-primary">Professional</div>
        <h1 className="font-display text-3xl">Your shop</h1>
        <p className="text-sm text-muted-foreground">Category: {categoryLabel}</p>
      </div>

      {/* Share */}
      <section className="rounded-2xl border border-primary/30 bg-primary-soft/40 p-5">
        <div className="text-sm font-semibold">Your shop link</div>
        <div className="mt-2 break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-sm">
          {shopUrl}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(shopUrl);
              toast.success("Copied");
            }}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <Copy className="h-4 w-4" /> Copy
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                if (navigator.share) {
                  await navigator.share({
                    title: pro.business_name,
                    text: `Check out ${pro.business_name} on FreshX`,
                    url: shopUrl,
                  });
                } else {
                  navigator.clipboard.writeText(shopUrl);
                  toast.success("Copied");
                }
              } catch {
                /* noop */
              }
            }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
          <Link
            to="/shop/$slug"
            params={{ slug: pro.slug }}
            className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            Preview
          </Link>
        </div>
      </section>

      {/* Business profile */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-display text-xl">Business details</h2>
        <label className="block text-sm">
          <span className="text-muted-foreground">Business name</span>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">WhatsApp number (with country code)</span>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="e.g. 2348012345678"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>Shop is visible to customers</span>
        </label>
        <button
          onClick={() => saveProfile.mutate()}
          disabled={saveProfile.isPending || businessName.trim().length < 2}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saveProfile.isPending ? "Saving…" : "Save changes"}
        </button>
      </section>

      {/* Catalog */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">Catalog</h2>
          <span className="text-xs text-muted-foreground">
            {pro.items.length} / 8 items
          </span>
        </div>

        <div className="space-y-3">
          {pro.items.map((it) => (
            <ItemRow
              key={it.id}
              value={it}
              onSave={(row) => upsertItem.mutate(row)}
              onDelete={() => {
                if (confirm(`Delete "${it.title}"?`)) removeItem.mutate(it.id!);
              }}
              saving={upsertItem.isPending}
            />
          ))}

          {pro.items.length < 8 && (
            <div className="rounded-lg border border-dashed border-border p-4">
              <div className="text-sm font-semibold">Add a new item</div>
              <ItemRow
                value={draft}
                onSave={(row) => upsertItem.mutate(row)}
                onChangeDraft={setDraft}
                saving={upsertItem.isPending}
                isNew
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ItemRow({
  value,
  onSave,
  onDelete,
  onChangeDraft,
  saving,
  isNew,
}: {
  value: Item;
  onSave: (row: Item) => void;
  onDelete?: () => void;
  onChangeDraft?: (row: Item) => void;
  saving: boolean;
  isNew?: boolean;
}) {
  const [row, setRow] = useState<Item>(value);

  useEffect(() => {
    if (!isNew) setRow(value);
  }, [value, isNew]);

  const cur = isNew ? value : row;
  const setCur = (r: Item) => {
    if (isNew) onChangeDraft?.(r);
    else setRow(r);
  };

  const canSave = cur.title.trim().length > 0 && cur.price >= 0;

  return (
    <div className="grid gap-2 md:grid-cols-[80px_1fr_120px_100px_auto] md:items-end">
      <div>
        {cur.image_url ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={cur.image_url}
            alt={cur.title}
            className="h-20 w-20 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
            No image
          </div>
        )}
      </div>
      <div className="space-y-1">
        <input
          value={cur.title}
          onChange={(e) => setCur({ ...cur, title: e.target.value })}
          placeholder="Item title"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          value={cur.image_url}
          onChange={(e) => setCur({ ...cur, image_url: e.target.value })}
          placeholder="Image URL (paste a hosted image URL)"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground"
        />
      </div>
      <label className="block text-xs text-muted-foreground">
        Price (₦)
        <input
          type="number"
          min={0}
          value={cur.price}
          onChange={(e) => setCur({ ...cur, price: Number(e.target.value) })}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        Position
        <input
          type="number"
          min={0}
          value={cur.position}
          onChange={(e) => setCur({ ...cur, position: Number(e.target.value) })}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSave || saving}
          onClick={() => onSave({ ...cur, title: cur.title.trim() })}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isNew ? "Add" : "Save"}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-destructive/40 p-2 text-destructive"
            aria-label="Delete item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
