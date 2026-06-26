import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet } from "lucide-react";
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

// Monday start of the week containing the given date, local time.
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun..6 Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  x.setDate(x.getDate() + diff);
  return x;
}
function endOfWeek(start: Date): Date {
  const x = new Date(start);
  x.setDate(x.getDate() + 7);
  x.setMilliseconds(-1);
  return x;
}
function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function AdminOrders() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const weekEnd = useMemo(() => endOfWeek(weekStart), [weekStart]);
  const isCurrentWeek =
    weekStart.getTime() === startOfWeek(new Date()).getTime();

  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", status, weekStart.toISOString()],
    queryFn: () =>
      adminListOrders({
        data: {
          status,
          start_date: weekStart.toISOString(),
          end_date: weekEnd.toISOString(),
        },
      }),
    refetchInterval: 15_000,
  });

  const update = useMutation({
    mutationFn: (vars: {
      order_id: string;
      status: "received" | "washing" | "ready" | "delivered" | "cancelled";
    }) => adminUpdateOrderStatus({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Order updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function shiftWeek(deltaDays: number) {
    setWeekStart((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + deltaDays);
      return startOfWeek(next);
    });
  }

  async function exportExcel() {
    if (!data?.length) return toast.error("Nothing to export for this week");
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Orders");
    ws.columns = [
      { header: "Order ID", key: "id", width: 18 },
      { header: "Date", key: "date", width: 22 },
      { header: "Customer", key: "customer", width: 24 },
      { header: "WhatsApp", key: "whatsapp", width: 16 },
      { header: "Service", key: "service", width: 12 },
      { header: "Items", key: "items", width: 40 },
      { header: "Delivery", key: "delivery", width: 12 },
      { header: "Address", key: "address", width: 30 },
      { header: "Subtotal", key: "subtotal", width: 12 },
      { header: "Delivery fee", key: "delivery_fee", width: 12 },
      { header: "Discount", key: "discount", width: 12 },
      { header: "Total (₦)", key: "total", width: 14 },
      { header: "Status", key: "status", width: 14 },
    ];
    data.forEach((o) => {
      ws.addRow({
        id: `FX-${o.id.slice(0, 8).toUpperCase()}`,
        date: new Date(o.created_at).toLocaleString(),
        customer: o.customer_name,
        whatsapp: o.customer_whatsapp,
        service: o.service_type,
        items: o.items_summary,
        delivery: o.delivery_method,
        address: o.address ?? "",
        subtotal: o.subtotal,
        delivery_fee: o.delivery_fee,
        discount: o.discount_amount,
        total: o.total_amount,
        status: o.status,
      });
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FreshX-Orders_${weekStart.toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel downloaded");
  }

  async function exportPdf() {
    if (!data?.length) return toast.error("Nothing to export for this week");
    const [{ default: jsPDF }, autoTableMod] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = (autoTableMod as { default: (doc: unknown, opts: unknown) => unknown }).default;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`FreshX Orders — ${fmtDate(weekStart)} to ${fmtDate(weekEnd)}`, 14, 14);
    doc.setFontSize(10);
    doc.text(
      `Total orders: ${data.length} · Revenue: NGN ${data
        .filter((o) => o.status !== "cancelled")
        .reduce((s, o) => s + o.total_amount, 0)
        .toLocaleString()}`,
      14,
      20,
    );
    autoTable(doc, {
      startY: 26,
      head: [["Order", "Date", "Customer", "Service", "Items", "Total (NGN)", "Status"]],
      body: data.map((o) => [
        `FX-${o.id.slice(0, 8).toUpperCase()}`,
        new Date(o.created_at).toLocaleDateString(),
        `${o.customer_name}\n${o.customer_whatsapp}`,
        o.service_type,
        o.items_summary,
        o.total_amount.toLocaleString(),
        o.status,
      ]),
      styles: { fontSize: 8, cellPadding: 2, valign: "top" },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      columnStyles: { 4: { cellWidth: 80 } },
    });
    doc.save(`FreshX-Orders_${weekStart.toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF downloaded");
  }

  const weekRevenue = (data ?? [])
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + o.total_amount, 0);

  return (
    <div className="space-y-4">
      {/* Week navigator */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <button
          onClick={() => shiftWeek(-7)}
          className="rounded-md border border-border p-2 hover:bg-muted"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-[200px]">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {isCurrentWeek ? "This week" : "Past week"}
          </div>
          <div className="text-sm font-medium">
            {fmtDate(weekStart)} → {fmtDate(weekEnd)}
          </div>
        </div>
        <button
          onClick={() => shiftWeek(7)}
          disabled={isCurrentWeek}
          className="rounded-md border border-border p-2 hover:bg-muted disabled:opacity-40"
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {!isCurrentWeek && (
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Jump to this week
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </button>
          <button
            onClick={exportPdf}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Status filter */}
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

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="rounded-md border border-border bg-card px-3 py-1.5">
          Orders this week: <span className="font-semibold">{data?.length ?? 0}</span>
        </div>
        <div className="rounded-md border border-border bg-card px-3 py-1.5">
          Revenue: <span className="font-semibold">{naira(weekRevenue)}</span>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">No orders for this week.</p>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border border-border">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Date</th>
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
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(o.created_at).toLocaleDateString()}
                    <br />
                    {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3">
                    <div>{o.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{o.customer_whatsapp}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {o.service_type} · {o.item_count} item{o.item_count === 1 ? "" : "s"}
                    <div className="text-xs text-muted-foreground">{o.delivery_method}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{naira(o.total_amount)}</td>
                  <td className="px-4 py-3 capitalize">{o.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(NEXT[o.status] ?? []).map((next) => (
                        <button
                          key={next}
                          disabled={update.isPending}
                          onClick={() =>
                            update.mutate({
                              order_id: o.id,
                              status: next as "washing" | "ready" | "delivered" | "cancelled",
                            })
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
