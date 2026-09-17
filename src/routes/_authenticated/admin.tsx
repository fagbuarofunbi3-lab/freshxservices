import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { getMe, isAdminRole, UserRole } from "@/lib/auth.functions";
import { useMe } from "../__root";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const me = await getMe();
    if (!me) throw redirect({ to: "/login" });
    if (!isAdminRole(me.role)) throw redirect({ to: "/dashboard" });
  },
  component: AdminLayout,
});

const ALL_TABS = [
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
  const { data: me } = useMe();
  const role = (me?.role as UserRole) || "admin";

  const visibleTabs = ALL_TABS.filter((t) => {
    if (role === "admin") return true;
    if (role === "operations") {
      return ["/admin", "/admin/orders", "/admin/customers", "/admin/catalog", "/admin/professionals"].includes(t.to);
    }
    if (role === "finance") {
      return ["/admin", "/admin/customers", "/admin/promos", "/admin/referrals"].includes(t.to);
    }
    if (role === "support") {
      return ["/admin", "/admin/orders", "/admin/customers"].includes(t.to);
    }
    return false;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-primary">Admin</div>
          <h1 className="font-display text-3xl">Back office</h1>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-border">
        {visibleTabs.map((t) => (
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
