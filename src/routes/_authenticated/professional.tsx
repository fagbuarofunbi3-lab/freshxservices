import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, ImagePlus, Share2, Trash2, Upload } from "lucide-react";
import {
  deleteMyCatalogItem,
  getMyProfessional,
  PRO_CATEGORIES,
  updateMyProfessional,
  uploadProfessionalImage,
  upsertMyCatalogItem,
} from "@/lib/professionals.functions";

export const Route = createFileRoute("/_authenticated/professional")({
  component: ProfessionalDashboard,
});

type Item = {
  id?: string;
  image_url: string; // storage path
  image_display_url?: string;
  title: string;
  price: number;
  position: number;
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function ProfessionalDashboard() {
  const qc = useQueryClient();
  const { data: pro, isLoading } = useQuery({
    queryKey: ["my-professional"],
    queryFn: () => getMyProfessional(),
  });

  const [businessName, setBusinessName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [logoPath, setLogoPath] = useState("");
  const [logoDisplay, setLogoDisplay] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState<Item>({ image_url: "", title: "", price: 0, position: 0 });
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pro && !hydrated) {
      setBusinessName(pro.business_name);
      setWhatsapp(pro.whatsapp_number);
      setIsActive(pro.is_active);
      setLogoPath(pro.logo_url ?? "");
      setLogoDisplay(pro.logo_display_url ?? "");
      setHydrated(true);
    }
  }, [pro, hydrated]);

  const saveProfile = useMutation({
    mutationFn: () =>
      updateMyProfessional({
        data: {
          business_name: businessName,
          whatsapp_number: whatsapp,
          is_active: isActive,
          logo_url: logoPath,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["my-professional"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upsertItem = useMutation({
    mutationFn: (row: Item) =>
      upsertMyCatalogItem({
        data: {
          id: row.id,
          image_url: row.image_url,
          title: row.title,
          price: row.price,
          position: row.position,
        },
      }),
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

  async function pickLogo(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file.");
      return;
    }
    setLogoBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await uploadProfessionalImage({
        data: { data_url: dataUrl, kind: "logo", filename: file.name },
      });
      setLogoPath(res.path);
      setLogoDisplay(res.url);
      toast.success("Logo uploaded — click Save changes.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLogoBusy(false);
    }
  }

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
            <Copy className="h-4 w-4" /> Copy link
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
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-display text-xl">Business details</h2>

        {/* Logo uploader */}
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
            {logoDisplay ? (
              <img src={logoDisplay} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                No logo
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">Business logo / profile picture</div>
            <p className="text-xs text-muted-foreground">
              Shown on your shop page and in browse listings.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickLogo(f);
                  e.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoBusy}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {logoBusy ? "Uploading…" : logoPath ? "Replace logo" : "Upload logo"}
              </button>
              {logoPath && (
                <button
                  type="button"
                  onClick={() => {
                    setLogoPath("");
                    setLogoDisplay("");
                  }}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

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
              value={{
                id: it.id,
                image_url: it.image_url,
                image_display_url: it.image_display_url,
                title: it.title,
                price: it.price,
                position: it.position,
              }}
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
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isNew) setRow(value);
  }, [value, isNew]);

  const cur = isNew ? value : row;
  const setCur = (r: Item) => {
    if (isNew) onChangeDraft?.(r);
    else setRow(r);
  };

  const canSave = cur.title.trim().length > 0 && cur.price >= 0;

  async function pickImage(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file.");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await uploadProfessionalImage({
        data: { data_url: dataUrl, kind: "catalog", filename: file.name },
      });
      setCur({ ...cur, image_url: res.path, image_display_url: res.url });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const preview = cur.image_display_url || (cur.image_url.startsWith("http") ? cur.image_url : "");

  return (
    <div className="grid gap-2 md:grid-cols-[96px_1fr_120px_100px_auto] md:items-end">
      <div>
        <div className="relative h-24 w-24 overflow-hidden rounded-md bg-muted">
          {preview ? (
            <img src={preview} alt={cur.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
              No image
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickImage(f);
            e.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="mt-1 inline-flex w-24 items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] disabled:opacity-50"
        >
          <ImagePlus className="h-3 w-3" />
          {uploading ? "…" : preview ? "Change" : "Upload"}
        </button>
      </div>
      <div className="space-y-1">
        <input
          value={cur.title}
          onChange={(e) => setCur({ ...cur, title: e.target.value })}
          placeholder="Item title"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <label className="block text-xs text-muted-foreground">
        Price ₦ (optional)
        <input
          type="number"
          min={0}
          value={cur.price === 0 ? "" : cur.price}
          placeholder="Leave blank to hide"
          onChange={(e) => {
            const v = e.target.value;
            setCur({ ...cur, price: v === "" ? 0 : Number(v) });
          }}
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
          disabled={!canSave || saving || uploading}
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
