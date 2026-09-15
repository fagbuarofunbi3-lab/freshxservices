import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/create-fn";
import { Bell } from "lucide-react";
import { listNotifications, markAllRead } from "@/lib/notifications.functions";

export function NotificationsBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mark = useServerFn(markAllRead);

  const { data: items = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const visible = items.filter((n) => n.channel === "in_app");
  const unread = visible.filter((n) => !n.is_read).length;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await mark({});
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="border-b border-border px-4 py-3">
            <div className="text-sm font-medium">Notifications</div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {visible.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                You're all caught up.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {visible.map((n) => (
                  <li key={n.id} className="px-4 py-3">
                    <div className="text-sm">{n.message}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
