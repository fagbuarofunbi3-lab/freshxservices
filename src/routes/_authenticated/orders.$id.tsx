import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/create-fn";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createOrder, getOrder } from "@/lib/orders.functions";
import { naira } from "@/lib/format";
import { useInvalidateMe } from "../__root";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  component: OrderDetailPage,
});

export function OrderSummary({ order, showTracker = true }: { order: NonNullable<Awaited<ReturnType<typeof getOrder>>>; showTracker?: boolean }) {
  const stepIdx = STATUSES.indexOf(order.status as (typeof STATUSES)[number]);
  const items = order.items_json?.items ?? [];
  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {order.service_type === "laundry" ? "Laundry" : "Cleaning"} order
            </div>
            <h1 className="font-display text-2xl">FX-{order.id.slice(0, 8).toUpperCase()}</h1>
            <div className="mt-1 text-xs text-muted-foreground">
              Placed {new Date(order.created_at).toLocaleString()}
            </div>
          </div>
          <span className="rounded-pill bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>

        {showTracker && order.status !== "cancelled" && (
          <div className="mt-6 grid grid-cols-4 gap-2">
            {STATUSES.map((s, i) => {
              const done = i <= stepIdx;
              return (
                <div key={s} className="text-center">
                  <div className="relative mx-auto h-2 w-full overflow-hidden rounded-full bg-border">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: done ? "100%" : "0%" }}
                      transition={{ duration: 0.5, delay: i * 0.08 }}
                      className="absolute inset-y-0 left-0 bg-primary"
                    />
                  </div>
                  <div className={`mt-2 text-[11px] ${done ? "text-foreground" : "text-muted-foreground"}`}>
                    {STATUS_LABELS[s]}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg">Items</h2>
        <ul className="mt-3 divide-y divide-border">
          {items.map((i, idx) => (
            <li key={idx} className="flex items-center justify-between py-3 text-sm">
              <div>
                <div className="font-medium">{i.name}</div>
                <div className="text-xs text-muted-foreground">
                  {naira(i.unit_price)} × {i.quantity}
                </div>
              </div>
              <div className="font-medium">{naira(i.line_total)}</div>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
          <Row label="Subtotal" value={naira(order.subtotal)} />
          <Row label="Delivery" value={naira(order.delivery_fee)} />
          {order.discount_amount > 0 && (
            <Row label="Discount" value={`−${naira(order.discount_amount)}`} />
          )}
          <div className="border-t border-border pt-2">
            <Row label="Total paid" value={naira(order.total_amount)} bold />
          </div>
        </dl>

        {(order.address || order.special_instructions) && (
          <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
            {order.address && (
              <div>
                <span className="text-muted-foreground">Pickup address: </span>
                {order.address}
              </div>
            )}
            {order.special_instructions && (
              <div>
                <span className="text-muted-foreground">Notes: </span>
                {order.special_instructions}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

const STATUSES = ["received", "washing", "ready", "delivered"] as const;
const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  washing: "Washing / Cleaning",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
  pending: "Pending",
};

function OrderDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const invalidateMe = useInvalidateMe();
  const create = useServerFn(createOrder);
  const [repeating, setRepeating] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder({ data: { id } }),
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }
  if (!order) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Order not found.</p>
        <Link to="/orders" className="text-sm text-primary hover:underline">
          ← Back to orders
        </Link>
      </div>
    );
  }

  const items = order.items_json?.items ?? [];

  async function repeat() {
    if (!order) return;
    if (items.length === 0) return toast.error("No items to repeat");
    setRepeating(true);
    try {
      const res = await create({
        data: {
          service_type: order.service_type,
          items: items.map((i) => ({
            service_item_id: i.service_item_id,
            name: i.name,
            unit_price: i.unit_price,
            quantity: i.quantity,
          })),
          delivery_method: order.delivery_method as "dropoff" | "pickup",
          delivery_fee: Number(order.delivery_fee),
          address: order.address ?? undefined,
        },
      });
      await Promise.all([
        invalidateMe(),
        qc.invalidateQueries({ queryKey: ["my-orders"] }),
        qc.invalidateQueries({ queryKey: ["wallet-tx"] }),
      ]);
      toast.success(`Order placed! ${naira(res.total)} deducted.`);
      navigate({ to: "/orders/$id", params: { id: res.order_id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not repeat order");
    } finally {
      setRepeating(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All orders
      </Link>

      <OrderSummary order={order} />

      <button
        onClick={repeat}
        disabled={repeating}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        <RotateCw className="h-4 w-4" />
        {repeating ? "Placing…" : "Repeat this order"}
      </button>
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
