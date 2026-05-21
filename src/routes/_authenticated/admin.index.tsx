import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminReports } from "@/lib/admin.functions";
import { naira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Overview });

function Overview() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-reports"], queryFn: () => adminReports() });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading reports…</p>;
  if (!data) return null;
  const cards = [
    { label: "Revenue (30d)", value: naira(data.total_revenue_30d) },
    { label: "Orders (30d)", value: data.order_count_30d.toString() },
    { label: "Laundry rev. (30d)", value: naira(data.laundry_revenue_30d) },
    { label: "Cleaning rev. (30d)", value: naira(data.cleaning_revenue_30d) },
    { label: "Wallet top-ups (30d)", value: naira(data.topups_30d) },
    { label: "Active orders", value: data.active_orders.toString() },
    { label: "Total customers", value: data.customers_total.toString() },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</div>
          <div className="mt-2 font-display text-2xl">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
