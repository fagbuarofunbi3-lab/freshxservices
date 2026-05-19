import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMyOrders } from "@/lib/orders.functions";
import { naira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/orders")({ component: OrdersPage });

function OrdersPage() {
  const { data: orders } = useQuery({ queryKey: ["my-orders"], queryFn: () => listMyOrders() });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Your orders</h1>
        <Link
          to="/order/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          New order
        </Link>
      </div>
      {(!orders || orders.length === 0) ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          You haven't placed any orders yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {o.service_type === "laundry" ? "Laundry" : "Cleaning"} · FX-
                    {o.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg">{naira(o.total_amount)}</div>
                  <div className="text-xs text-muted-foreground">{o.status}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
