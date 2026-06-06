import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, Minus, Plus, MessageCircle, Info } from "lucide-react";
import { applyPromo, createOrder, listServiceItems } from "@/lib/orders.functions";
import { useMe, useInvalidateMe } from "../__root";
import { naira } from "@/lib/format";

const WHATSAPP_ADMIN_NUMBER = "2349114292652";

export const Route = createFileRoute("/_authenticated/order/new")({ component: NewOrderPage });

const LAUNDRY_TABS = [
  { id: "laundry_soft", label: "Soft Clothes" },
  { id: "laundry_hard", label: "Hard Clothes" },
  { id: "laundry_bedding", label: "Bedding & Home" },
] as const;

const CLEANING_SPACES = [
  { id: "cleaning_apartment", label: "Apartment", sub: "Self-contained to duplex" },
  { id: "cleaning_office", label: "Office", sub: "Per-room pricing" },
  { id: "cleaning_other", label: "Other", sub: "Shop, school, custom" },
] as const;

const RECURRING_OPTIONS = [
  { id: "one_off", label: "One-off" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Bi-weekly" },
  { id: "monthly", label: "Monthly" },
] as const;

function NewOrderPage() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const invalidateMe = useInvalidateMe();
  const create = useServerFn(createOrder);
  const applyPromoFn = useServerFn(applyPromo);
  const { data: items = [] } = useQuery({
    queryKey: ["service-items"],
    queryFn: () => listServiceItems(),
  });

  const [service, setService] = useState<"laundry" | "cleaning" | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<(typeof LAUNDRY_TABS)[number]["id"]>("laundry_soft");
  const [cleaningSpace, setCleaningSpace] =
    useState<(typeof CLEANING_SPACES)[number]["id"] | null>(null);
  const [recurring, setRecurring] =
    useState<(typeof RECURRING_OPTIONS)[number]["id"]>("one_off");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [delivery, setDelivery] = useState<"dropoff" | "pickup">("dropoff");
  const [address, setAddress] = useState("");
  const [promo, setPromo] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [pin, setPin] = useState("");

  const deliveryItem = items.find((i) => i.category === "delivery");
  const deliveryFee = delivery === "pickup" ? (deliveryItem?.price ?? 1000) : 0;

  const visibleItems = useMemo(() => {
    if (service === "laundry") return items.filter((i) => i.category === tab);
    if (service === "cleaning" && cleaningSpace)
      return items.filter((i) => i.category === cleaningSpace);
    return [];
  }, [items, service, tab, cleaningSpace]);

  const subtotal = useMemo(
    () =>
      Object.entries(qty).reduce((s, [id, n]) => {
        const it = items.find((i) => i.id === id);
        return s + (it ? it.price * n : 0);
      }, 0),
    [qty, items],
  );

  const discount = appliedPromo?.discount ?? 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  function inc(id: string, by: number) {
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + by) }));
  }

  async function applyCode() {
    if (!promo.trim()) return toast.error("Enter a promo code");
    if (subtotal <= 0) return toast.error("Add items before applying a promo");
    setApplyingPromo(true);
    try {
      const res = await applyPromoFn({ data: { code: promo, subtotal } });
      if (!res.ok) {
        setAppliedPromo(null);
        return toast.error(res.message);
      }
      setAppliedPromo({ code: res.code, discount: res.discount });
      toast.success(`${res.code} applied — ${naira(res.discount)} off`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not apply promo");
    } finally {
      setApplyingPromo(false);
    }
  }

  async function confirm() {
    if (!service) return;
    const selected = Object.entries(qty)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => {
        const it = items.find((i) => i.id === id)!;
        return { service_item_id: id, name: it.name, unit_price: it.price, quantity: n };
      });
    if (selected.length === 0) return toast.error("Add at least one item");
    setLoading(true);
    try {
      const res = await create({
        data: {
          service_type: service,
          items: selected,
          delivery_method: delivery,
          delivery_fee: deliveryFee,
          address: delivery === "pickup" || service === "cleaning" ? address : undefined,
          special_instructions: notes || undefined,
          promo_code: promo || undefined,
          preferred_date: preferredDate || undefined,
          preferred_time: preferredTime || undefined,
          space_type: service === "cleaning" ? (cleaningSpace ?? undefined) : undefined,
          recurring: service === "cleaning" ? recurring : undefined,
        },
      });
      await Promise.all([
        invalidateMe(),
        qc.invalidateQueries({ queryKey: ["my-orders"] }),
        qc.invalidateQueries({ queryKey: ["wallet-tx"] }),
      ]);
      toast.success(`Order placed! ${naira(res.total)} deducted.`);
      navigate({ to: "/order/confirmed/$id", params: { id: res.order_id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place order");
    } finally {
      setLoading(false);
    }
  }

  if (!service) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-display text-2xl">What do you need?</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ServicePick
            icon={<Sparkles className="h-6 w-6 text-primary" />}
            title="Laundry"
            sub="Wash & fold your clothes"
            onClick={() => setService("laundry")}
          />
          <ServicePick
            icon={<ShieldCheck className="h-6 w-6 text-primary" />}
            title="Cleaning"
            sub="Deep clean your space"
            onClick={() => setService("cleaning")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl">
            {service === "laundry" ? "Build your laundry order" : "Choose your cleaning"}
          </h1>
          <button onClick={() => setService(null)} className="text-sm text-muted-foreground hover:underline">
            Change service
          </button>
        </div>

        {service === "laundry" && (
          <div className="inline-flex flex-wrap gap-1 rounded-md border border-border p-1">
            {LAUNDRY_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded px-3 py-1.5 text-sm ${
                  tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {service === "cleaning" && (
          <div className="grid gap-2 md:grid-cols-3">
            {CLEANING_SPACES.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setCleaningSpace(s.id);
                  setQty({});
                }}
                className={`rounded-xl border p-4 text-left transition ${
                  cleaningSpace === s.id
                    ? "border-primary bg-primary-soft"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.sub}</div>
              </button>
            ))}
          </div>
        )}

        {(service === "laundry" || cleaningSpace) && (
          <motion.div layout className="rounded-2xl border border-border bg-card">
            <ul className="divide-y divide-border">
              {visibleItems.map((it) => {
                const n = qty[it.id] ?? 0;
                return (
                  <li key={it.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <div className="text-sm font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground">{naira(it.price)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => inc(it.id, -1)}
                        disabled={n === 0}
                        className="rounded-md border border-border p-1.5 disabled:opacity-40"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{n}</span>
                      <button
                        onClick={() => inc(it.id, 1)}
                        className="rounded-md border border-border p-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}

        {service === "cleaning" && cleaningSpace && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="font-medium">Schedule</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Preferred date</span>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Preferred time</span>
                <input
                  type="time"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-4">
              <div className="text-xs text-muted-foreground">Frequency</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {RECURRING_OPTIONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRecurring(r.id)}
                    className={`rounded-pill border px-3 py-1.5 text-xs font-medium ${
                      recurring === r.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Cleaning address"
              className="mt-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special instructions (optional)"
              className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={2}
            />
          </div>
        )}

        {service === "laundry" && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="font-medium">Delivery</div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {([
                { id: "dropoff", label: "I'll drop off myself", sub: "No extra charge" },
                { id: "pickup", label: "Request pickup & delivery", sub: `+${naira(deliveryItem?.price ?? 1000)}` },
              ] as const).map((o) => (
                <button
                  key={o.id}
                  onClick={() => setDelivery(o.id)}
                  className={`rounded-xl border p-4 text-left ${
                    delivery === o.id ? "border-primary bg-primary-soft" : "border-border"
                  }`}
                >
                  <div className="text-sm font-medium">{o.label}</div>
                  <div className="text-xs text-muted-foreground">{o.sub}</div>
                </button>
              ))}
            </div>
            {delivery === "pickup" && (
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Pickup address"
                className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            )}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special instructions (optional)"
              className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={2}
            />
          </div>
        )}
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-lg">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Subtotal" value={naira(subtotal)} />
            <Row label="Delivery" value={naira(deliveryFee)} />
            {discount > 0 && <Row label={`Promo (${appliedPromo?.code})`} value={`−${naira(discount)}`} />}
            <div className="border-t border-border pt-2">
              <Row label="Total" value={naira(total)} bold />
            </div>
          </dl>
          <div className="mt-4">
            <div className="flex gap-2">
              <input
                value={promo}
                onChange={(e) => {
                  setPromo(e.target.value.toUpperCase());
                  setAppliedPromo(null);
                }}
                placeholder="Promo code (try FRESH10)"
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={applyCode}
                disabled={applyingPromo || subtotal === 0}
                className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                {applyingPromo ? "Checking…" : "Apply"}
              </button>
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Wallet balance: <span className="font-medium text-foreground">{naira(me?.wallet_balance ?? 0)}</span>
          </div>
          <button
            onClick={confirm}
            disabled={loading || total === 0}
            className="mt-5 w-full rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Placing order…" : "Confirm Order"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={bold ? "font-display text-lg" : "font-medium"}>{value}</dd>
    </div>
  );
}

function ServicePick({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="rounded-2xl border border-border bg-card p-8 text-left transition hover:border-primary hover:shadow-xl hover:shadow-primary/5"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft">{icon}</div>
      <h3 className="mt-5 font-display text-xl">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </motion.button>
  );
}
