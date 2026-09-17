import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, X } from "lucide-react";
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

type AdminOrder = Awaited<ReturnType<typeof adminListOrders>>[number];

type RangeMode = "week" | "month" | "90d" | "6m" | "1y" | "custom";
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}
function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function isoFromDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function AdminOrders() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [mode, setMode] = useState<RangeMode>("week");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const now = new Date();
  const [monthYear, setMonthYear] = useState<number>(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState<number>(now.getMonth());
  const [customStart, setCustomStart] = useState<string>(isoFromDaysAgo(7));
  const [customEnd, setCustomEnd] = useState<string>(todayISO());
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  // Compute the actual [start, end] Date range from the current mode.
  const { rangeStart, rangeEnd, rangeLabel } = useMemo(() => {
    if (mode === "week") {
      const s = weekStart;
      const e = new Date(s);
      e.setDate(e.getDate() + 7);
      e.setMilliseconds(-1);
      return { rangeStart: s, rangeEnd: e, rangeLabel: `${fmtDate(s)} → ${fmtDate(e)}` };
    }
    if (mode === "month") {
      const s = new Date(monthYear, monthIdx, 1);
      const e = new Date(monthYear, monthIdx + 1, 1);
      e.setMilliseconds(-1);
      return { rangeStart: s, rangeEnd: e, rangeLabel: `${MONTH_NAMES[monthIdx]} ${monthYear}` };
    }
    if (mode === "90d" || mode === "6m" || mode === "1y") {
      const s = new Date();
      if (mode === "90d") s.setDate(s.getDate() - 90);
      if (mode === "6m") s.setMonth(s.getMonth() - 6);
      if (mode === "1y") s.setFullYear(s.getFullYear() - 1);
      s.setHours(0, 0, 0, 0);
      const e = new Date();
      return {
        rangeStart: s,
        rangeEnd: e,
        rangeLabel: `${fmtDate(s)} → ${fmtDate(e)}`,
      };
    }
    // custom
    const s = new Date(customStart + "T00:00:00");
    const e = new Date(customEnd + "T23:59:59");
    return { rangeStart: s, rangeEnd: e, rangeLabel: `${fmtDate(s)} → ${fmtDate(e)}` };
  }, [mode, weekStart, monthYear, monthIdx, customStart, customEnd]);

  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: [
      "admin-orders",
      status,
      mode,
      rangeStart.toISOString(),
      rangeEnd.toISOString(),
    ],
    queryFn: () =>
      adminListOrders({
        data: {
          status,
          start_date: rangeStart.toISOString(),
          end_date: rangeEnd.toISOString(),
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
  function shiftMonth(delta: number) {
    let m = monthIdx + delta;
    let y = monthYear;
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    setMonthIdx(m);
    setMonthYear(y);
  }

  async function exportExcel() {
    if (!data?.length) return toast.error("Nothing to export for this range");
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
    a.download = `FreshX-Orders_${rangeStart.toISOString().slice(0, 10)}_to_${rangeEnd
      .toISOString()
      .slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel downloaded");
  }

  async function exportPdf() {
    if (!data?.length) return toast.error("Nothing to export for this range");
    const [{ default: jsPDF }, autoTableMod] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = (autoTableMod as { default: (doc: unknown, opts: unknown) => unknown }).default;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`FreshX Orders — ${rangeLabel}`, 14, 14);
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
    doc.save(`FreshX-Orders_${rangeStart.toISOString().slice(0, 10)}_to_${rangeEnd
      .toISOString()
      .slice(0, 10)}.pdf`);
    toast.success("PDF downloaded");
  }

  const rangeRevenue = (data ?? [])
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + o.total_amount, 0);

  const MODES: { key: RangeMode; label: string }[] = [
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "90d", label: "90 days" },
    { key: "6m", label: "6 months" },
    { key: "1y", label: "1 year" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="space-y-4">
      {/* Range mode picker */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              mode === m.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Range navigator */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        {mode === "week" && (
          <>
            <button
              onClick={() => shiftWeek(-7)}
              className="rounded-md border border-border p-2 hover:bg-muted"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-[200px]">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Week</div>
              <div className="text-sm font-medium">{rangeLabel}</div>
            </div>
            <button
              onClick={() => shiftWeek(7)}
              disabled={weekStart.getTime() >= startOfWeek(new Date()).getTime()}
              className="rounded-md border border-border p-2 hover:bg-muted disabled:opacity-40"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {mode === "month" && (
          <>
            <button
              onClick={() => shiftMonth(-1)}
              className="rounded-md border border-border p-2 hover:bg-muted"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 flex flex-wrap items-center gap-2">
              <select
                value={monthIdx}
                onChange={(e) => setMonthIdx(Number(e.target.value))}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {MONTH_NAMES.map((n, i) => (
                  <option key={n} value={i}>{n}</option>
                ))}
              </select>
              <input
                type="number"
                value={monthYear}
                min={2020}
                max={now.getFullYear() + 1}
                onChange={(e) => setMonthYear(Number(e.target.value))}
                className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <button
              onClick={() => shiftMonth(1)}
              className="rounded-md border border-border p-2 hover:bg-muted"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {(mode === "90d" || mode === "6m" || mode === "1y") && (
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {mode === "90d" ? "Last 90 days" : mode === "6m" ? "Last 6 months" : "Last 1 year"}
            </div>
            <div className="text-sm font-medium">{rangeLabel}</div>
          </div>
        )}

        {mode === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
          </div>
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
          Orders in range: <span className="font-semibold">{data?.length ?? 0}</span>
        </div>
        <div className="rounded-md border border-border bg-card px-3 py-1.5">
          Revenue: <span className="font-semibold">{naira(rangeRevenue)}</span>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">No orders in this range.</p>
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
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(o)}
                      className="font-mono text-xs font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      FX-{o.id.slice(0, 8).toUpperCase()}
                    </button>
                  </td>
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
                    {o.service_type.replace("_", " ")} · {o.item_count} item{o.item_count === 1 ? "" : "s"}
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

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-border bg-background p-5 shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-semibold text-primary">
                  FX-{selectedOrder.id.slice(0, 8).toUpperCase()}
                </p>
                <h2 className="mt-1 font-display text-xl capitalize">
                  {selectedOrder.service_type.replace("_", " ")} order
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(selectedOrder.created_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-md border border-border p-2 hover:bg-muted"
                aria-label="Close order details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Customer</div>
                <div className="mt-1 font-medium">{selectedOrder.customer_name}</div>
                <div className="text-muted-foreground">{selectedOrder.customer_whatsapp}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div>
                <div className="mt-1 font-medium capitalize">{selectedOrder.status}</div>
                <div className="text-muted-foreground capitalize">{selectedOrder.delivery_method}</div>
              </div>
              {selectedOrder.address && (
                <div className="rounded-lg border border-border p-3 sm:col-span-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Address</div>
                  <div className="mt-1">{selectedOrder.address}</div>
                </div>
              )}
              {selectedOrder.special_instructions && (
                <div className="rounded-lg border border-border p-3 sm:col-span-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Instructions</div>
                  <div className="mt-1">{selectedOrder.special_instructions}</div>
                </div>
              )}
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">What they ordered</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.length ? (
                    selectedOrder.items.map((item, index) => (
                      <tr key={`${item.name}-${index}`} className="border-t border-border">
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2 text-center">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{naira(item.line_total)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                        No item details saved for this order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 space-y-2 rounded-lg bg-muted/50 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span>Subtotal</span>
                <span>{naira(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Delivery</span>
                <span>{naira(selectedOrder.delivery_fee)}</span>
              </div>
              {selectedOrder.discount_amount > 0 && (
                <div className="flex justify-between gap-4">
                  <span>Discount</span>
                  <span>-{naira(selectedOrder.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
                <span>Total</span>
                <span>{naira(selectedOrder.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
