import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { getOrder } from "@/lib/orders.functions";
import { OrderSummary } from "./orders.$id";

export const Route = createFileRoute("/_authenticated/order/confirmed/$id")({
  component: OrderConfirmedPage,
});

function OrderConfirmedPage() {
  const { id } = Route.useParams();
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder({ data: { id } }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <section className="rounded-2xl border border-success/30 bg-success/10 p-6">
        <div className="flex items-start gap-4">
          <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-success" />
          <div>
            <h1 className="font-display text-2xl">Order confirmed</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your order has been received. FreshX will update the progress here.
            </p>
          </div>
        </div>
      </section>

      {order ? <OrderSummary order={order} /> : <p className="text-sm text-muted-foreground">Order not found.</p>}

      <div className="flex flex-wrap gap-2">
        <Link
          to="/dashboard"
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Go to dashboard
        </Link>
        <Link
          to="/orders/$id"
          params={{ id }}
          className="rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted"
        >
          Track order
        </Link>
      </div>
    </div>
  );
}