import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Home, ShoppingBag, Wallet, Settings, Plus, LogOut } from "lucide-react";
import { getMe, logOut } from "@/lib/auth.functions";
import { useMe, useInvalidateMe } from "./__root";
import { NotificationsBell } from "@/components/NotificationsBell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const me = await getMe();
    if (!me) throw redirect({ to: "/login" });
    return { me };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { data: me } = useMe();
  const logoutFn = useServerFn(logOut);
  const invalidate = useInvalidateMe();
  const navigate = useNavigate();

  async function onLogout() {
    await logoutFn({});
    await invalidate();
    navigate({ to: "/" });
  }

  const items = [
    { to: "/dashboard", icon: Home, label: "Home" },
    { to: "/order/new", icon: Plus, label: "New Order" },
    { to: "/orders", icon: ShoppingBag, label: "Orders" },
    { to: "/wallet", icon: Wallet, label: "Wallet" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ] as const;

  return (
    <div className="min-h-screen bg-[color:var(--surface)] text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-card p-6 md:flex md:flex-col">
        <Link to="/" className="font-display text-2xl font-bold">
          Fresh<span className="text-primary">X</span>
        </Link>
        <nav className="mt-10 flex flex-col gap-1">
          {items.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              activeProps={{ className: "bg-primary-soft text-primary" }}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={onLogout}
          className="mt-auto flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-5 py-3 backdrop-blur md:ml-64 md:px-8">
        <div>
          <div className="text-xs text-muted-foreground">Good day 👋</div>
          <div className="font-display text-lg leading-tight">{me?.full_name ?? "Welcome"}</div>
        </div>
        <div className="flex items-center gap-1">
          <NotificationsBell />
          <button
            onClick={onLogout}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive md:hidden"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="px-5 pb-24 pt-6 md:ml-64 md:px-8 md:pb-10">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {items.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              activeProps={{ className: "text-primary" }}
              className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground"
            >
              <it.icon className="h-5 w-5" />
              {it.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
