import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { listMyOrders } from "@/lib/orders.functions";
import { useMe } from "../__root";
import { naira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: DashboardPage });

const STATUSES = ["received", "washing", "ready", "delivered"] as const;
const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  washing: "Washing / Cleaning",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
  pending: "Pending",
};

function DashboardPage() {
  const { data: me } = useMe();
  const { data: orders } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => listMyOrders(),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const active = orders?.find((o) => o.status !== "delivered" && o.status !== "cancelled");
  const recent = orders?.slice(0, 3) ?? [];
  const balance = me?.wallet_balance ?? 0;
  const lowBalance = balance < 500;

  return (
    <div className="space-y-6">
      {/* Wallet card */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass relative overflow-hidden rounded-2xl p-6 md:p-8"
      >
        <div className="freshx-blob" style={{ background: "var(--color-primary)", width: 300, height: 300, top: -100, right: -100, opacity: 0.25 }} />
        <div className="relative">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Available balance</div>
          <div className="mt-2 font-display text-5xl">{naira(balance)}</div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/wallet"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Top Up
            </Link>
            <Link
              to="/wallet"
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              View Transactions
            </Link>
          </div>
        </div>
      </motion.section>

      {lowBalance && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div>Your balance is low. Top up to keep placing orders.</div>
        </div>
      )}

      {/* Active order tracker */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-xl">Current order</h2>
        {active ? (
          <div className="mt-4">
            <div className="text-sm text-muted-foreground">
              FX-{active.id.slice(0, 8).toUpperCase()} · {active.service_type === "laundry" ? "Laundry" : "Cleaning"} ·{" "}
              {new Date(active.created_at).toLocaleDateString()}
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2">
              {STATUSES.map((s) => {
                const stepIdx = STATUSES.indexOf(active.status as (typeof STATUSES)[number]);
                const myIdx = STATUSES.indexOf(s);
                const done = myIdx <= stepIdx;
                const isActive = myIdx === stepIdx;
                return (
                  <div key={s} className="text-center">
                    <div className="relative mx-auto h-2 w-full overflow-hidden rounded-full bg-border">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: done ? "100%" : "0%" }}
                        transition={{ duration: 0.6, delay: myIdx * 0.1 }}
                        className="absolute inset-y-0 left-0 bg-primary"
                      />
                    </div>
                    <div className={`mt-2 text-[11px] ${done ? "text-foreground" : "text-muted-foreground"}`}>
                      {STATUS_LABELS[s]}
                      {isActive && (
                        <motion.span
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1.4, repeat: Infinity }}
                          className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-3 py-8 text-center">
            <div className="text-muted-foreground">No active orders yet.</div>
            <Link
              to="/order/new"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Place your first order <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </section>

      {/* Recent orders */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Recent orders</h2>
          <Link to="/orders" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">Your orders will appear here.</div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {recent.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-sm font-medium">
                    {o.service_type === "laundry" ? "Laundry" : "Cleaning"} · FX-
                    {o.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()} · {naira(o.total_amount)}
                  </div>
                </div>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    received: "bg-primary-soft text-primary",
    washing: "bg-warning/15 text-warning",
    ready: "bg-success/15 text-success",
    delivered: "bg-success/15 text-success",
    cancelled: "bg-destructive/15 text-destructive",
    pending: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`rounded-pill px-2.5 py-1 text-[11px] font-medium ${map[status] ?? "bg-muted"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
