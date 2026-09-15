import { apiClient } from "@/lib/api-client";
import { createFn } from "@/lib/create-fn";

export const listNotifications = createFn({ method: "GET" }).handler(async () => {
  const data = await apiClient.get<any[]>("/api/notifications");
  return (data ?? []).map((r) => ({
    id: (r.id || r._id) as string,
    message: r.message as string,
    type: (r.type || "info") as string,
    channel: (r.channel || "in_app") as string,
    is_read: Boolean(r.is_read),
    created_at: (r.created_at as string) ?? new Date().toISOString(),
  }));
});

export const markAllRead = createFn({ method: "POST" }).handler(async () => {
  await apiClient.post("/api/notifications/read-all");
  return { ok: true };
});
