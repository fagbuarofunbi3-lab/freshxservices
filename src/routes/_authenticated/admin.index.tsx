import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Package, Percent, ShoppingBag, Users } from "lucide-react";
import { adminMonthlyReports, adminReports } from "@/lib/admin.functions";
import { naira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Overview });

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function Overview() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);

  const { data: totals } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => adminReports(),
  });
  const { data: monthly, isLoading } = useQuery({
    queryKey: ["admin-monthly", year],
    queryFn: () => adminMonthlyReports({ data: { year } }),
  });

  const selected = monthly?.months[selectedMonth];

  const yearTotals = useMemo(() => {
    if (!monthly) return { revenue: 0, orders: 0, laundry: 0, cleaning: 0, pest_control: 0, topups: 0 };
    return monthly.months.reduce(
      (a, m) => ({
        revenue: a.revenue + m.revenue,
        orders: a.orders + m.orders,
        laundry: a.laundry + m.laundry,
        cleaning: a.cleaning + m.cleaning,
        pest_control: a.pest_control + (m.pest_control ?? 0),
        topups: a.topups + m.topups,
      }),
      { revenue: 0, orders: 0, laundry: 0, cleaning: 0, pest_control: 0, topups: 0 },
    );
  }, [monthly]);

  return (
    <div className="space-y-6">
      {/* At-a-glance totals (30d) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Revenue (30d)" value={naira(totals?.total_revenue_30d ?? 0)} />
        <StatCard label="Laundry (30d)" value={naira(totals?.laundry_revenue ?? 0)} />
        <StatCard label="Cleaning (30d)" value={naira(totals?.cleaning_revenue ?? 0)} />
        <StatCard label="Pest Control (30d)" value={naira(totals?.pest_control_revenue ?? 0)} />
        <StatCard label="Total customers" value={String(totals?.customers_total ?? 0)} />
      </div>

      {/* Year navigator */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <button
          onClick={() => setYear((y) => y - 1)}
          className="rounded-md border border-border p-2 hover:bg-muted"
          aria-label="Previous year"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Year</div>
          <div className="font-display text-xl">{year}</div>
        </div>
        <button
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= currentYear}
          className="rounded-md border border-border p-2 hover:bg-muted disabled:opacity-40"
          aria-label="Next year"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="ml-auto text-xs">
          Year total:{" "}
          <span className="font-semibold text-foreground">{naira(yearTotals.revenue)}</span>{" "}
          · {yearTotals.orders} orders
        </div>
      </div>

      {/* Month cards */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading monthly report…</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {MONTH_NAMES.map((name, i) => {
            const m = monthly?.months[i];
            const isFuture = year === currentYear && i > currentMonth;
            const active = selectedMonth === i;
            return (
              <button
                key={name}
                onClick={() => setSelectedMonth(i)}
                disabled={isFuture}
                className={`rounded-xl border p-3 text-left transition disabled:opacity-40 ${
                  active
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {name.slice(0, 3)} {year}
                </div>
                <div className="mt-1 font-semibold">{naira(m?.revenue ?? 0)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {m?.orders ?? 0} order{(m?.orders ?? 0) === 1 ? "" : "s"}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected month detail */}
      {selected && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wider text-primary">
            {MONTH_NAMES[selectedMonth]} {year}
          </div>
          <div className="mt-1 font-display text-2xl">{naira(selected.revenue)} revenue</div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Orders" value={String(selected.orders)} />
            <StatCard label="Laundry" value={naira(selected.laundry)} />
            <StatCard label="Cleaning" value={naira(selected.cleaning)} />
            <StatCard label="Pest Control" value={naira(selected.pest_control ?? 0)} />
            <StatCard label="Wallet top-ups" value={naira(selected.topups)} />
          </div>
        </section>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink to="/admin/catalog" icon={Package} title="Prices & Categories" body="Edit laundry and cleaning items." />
        <QuickLink to="/admin/orders" icon={ShoppingBag} title="Orders" body="Update customer order status." />
        <QuickLink to="/admin/customers" icon={Users} title="Customers" body="View customers and adjust wallets." />
        <QuickLink to="/admin/promos" icon={Percent} title="Promos" body="Create discounts and promo codes." />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl">{value}</div>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: "/admin/catalog" | "/admin/orders" | "/admin/customers" | "/admin/promos";
  icon: typeof Package;
  title: string;
  body: string;
}) {
  return (
    <Link to={to} className="rounded-xl border border-border bg-card p-5 transition hover:border-primary/50 hover:bg-primary-soft/40">
      <Icon className="h-5 w-5 text-primary" />
      <div className="mt-3 font-semibold">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{body}</div>
    </Link>
  );
}
