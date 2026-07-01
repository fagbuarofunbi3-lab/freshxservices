import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFreshXSession } from "@/lib/session.server";

const DEFAULT_CONTACT_WHATSAPP = "2348132589218";

async function requireAdmin(): Promise<void> {
  const session = await getFreshXSession();
  const id = session.data?.profileId;
  if (!id) throw new Error("Not signed in");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.role !== "admin") throw new Error("Admin access required");
}

function normalizeWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return "234" + digits.slice(1);
  return digits;
}

// ---------- Contact WhatsApp ----------
export const getContactWhatsapp = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "contact_whatsapp_number")
    .maybeSingle();
  return { number: (data?.value as string | undefined) ?? DEFAULT_CONTACT_WHATSAPP };
});

export const adminUpdateContactWhatsapp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ number: z.string().trim().min(7).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const value = normalizeWhatsapp(data.number);
    if (value.length < 10) throw new Error("Enter a valid WhatsApp number");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: "contact_whatsapp_number", value, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true, number: value };
  });

// ---------- Media: promo video + dashboard carousel images ----------
// Stored as simple key/value strings. Images are a JSON array of URLs (max 4).

export const getSiteMedia = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("key, value")
    .in("key", ["promo_video_url", "dashboard_images"]);
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]));
  let images: string[] = [];
  const raw = map.get("dashboard_images");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) images = parsed.filter((v): v is string => typeof v === "string");
    } catch {
      /* ignore */
    }
  }
  return {
    video_url: (map.get("promo_video_url") ?? "").trim(),
    images: images.slice(0, 4),
  };
});

export const adminUpdateSiteMedia = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        video_url: z.string().trim().max(500).default(""),
        images: z.array(z.string().trim().max(500)).max(4).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const cleanImages = data.images.map((s) => s.trim()).filter(Boolean).slice(0, 4);
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("site_settings").upsert([
      { key: "promo_video_url", value: data.video_url.trim(), updated_at: now },
      { key: "dashboard_images", value: JSON.stringify(cleanImages), updated_at: now },
    ]);
    if (error) throw new Error(error.message);
    return { ok: true, video_url: data.video_url.trim(), images: cleanImages };
  });
