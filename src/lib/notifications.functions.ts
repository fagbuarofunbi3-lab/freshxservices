import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFreshXSession } from "@/lib/session.server";

async function requireProfileId(): Promise<string> {
  const session = await getFreshXSession();
  const id = session.data?.profileId;
  if (!id) throw new Error("Not signed in");
  return id;
}

export const listNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const profileId = await requireProfileId();
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id, message, channel, type, is_read, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    message: r.message as string,
    type: r.type as string,
    channel: r.channel as string,
    is_read: Boolean(r.is_read),
    created_at: r.created_at as string,
  }));
});

export const markAllRead = createServerFn({ method: "POST" }).handler(async () => {
  const profileId = await requireProfileId();
  await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("profile_id", profileId)
    .eq("is_read", false);
  return { ok: true };
});
