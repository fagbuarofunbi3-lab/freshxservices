import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { adminListOrders, adminUpdateOrderStatus } from "@/lib/admin.functions";
import { naira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/orders")({ component: AdminOrders });

const STATUSES = ["all", "received", "washing", "ready", "delivered", "cancelled"] as const;
const NEXT: Record<string, string[]> = {
  received: ["washing", "cancelled"],
  washing: ["ready", "cancelled"],
  ready: ["delivered"],
  delivered: [],
  cancelled: [],
};

function AdminOrders() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", status],
    queryFn: () => adminListOrders({ data: { status } }),
    refetchInterval: 15_000,
  });

  const update = useMutation({
    mutationFn: (vars: { order_id: string; status: "received" | "washing" | "ready" | "delivered" | "cancelled" }) =>
      adminUpdateOrderStatus({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Order updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              s === status ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">No orders in this view.</p>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border border-border">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs">FX-{o.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <div>{o.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{o.customer_whatsapp}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {o.service_type} · {o.item_count} item{o.item_count === 1 ? "" : "s"}
                    <div className="text-xs text-muted-foreground">{o.delivery_method}</div>
                  </td>
                  <td className="px-4 py-3">{naira(o.total_amount)}</td>
                  <td className="px-4 py-3 capitalize">{o.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(NEXT[o.status] ?? []).map((next) => (
                        <button
                          key={next}
                          disabled={update.isPending}
                          onClick={() =>
                            update.mutate({ order_id: o.id, status: next as "washing" | "ready" | "delivered" | "cancelled" })
                          }
                          className="rounded-md border border-border px-2 py-1 text-xs capitalize hover:bg-muted"
                        >
                          → {next}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
