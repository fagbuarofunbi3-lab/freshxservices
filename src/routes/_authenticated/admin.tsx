import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { getMe } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const me = await getMe();
    if (!me) throw redirect({ to: "/login" });
    if (me.role !== "admin") throw redirect({ to: "/dashboard" });
  },
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/customers", label: "Customers" },
  { to: "/admin/catalog", label: "Catalog" },
  { to: "/admin/promos", label: "Promos" },
  { to: "/admin/referrals", label: "Referrals" },
  { to: "/admin/professionals", label: "Professionals" },
  { to: "/admin/settings", label: "Settings" },

] as const;

function AdminLayout() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-primary">Admin</div>
        <h1 className="font-display text-3xl">Back office</h1>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={{ exact: t.to === "/admin" }}
            activeProps={{ className: "border-primary text-foreground" }}
            className="whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
