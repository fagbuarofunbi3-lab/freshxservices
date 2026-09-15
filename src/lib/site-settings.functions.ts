import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import { createFn } from "@/lib/create-fn";

const DEFAULT_CONTACT_WHATSAPP = "2348132589218";

function normalizeWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return "234" + digits.slice(1);
  return digits;
}

// ---------- Contact WhatsApp ----------
export const getContactWhatsapp = createFn({ method: "GET" }).handler(async () => {
  try {
    const settings = await apiClient.get<any>("/api/settings");
    return { number: (settings?.whatsapp_admin_phone as string | undefined) || DEFAULT_CONTACT_WHATSAPP };
  } catch {
    return { number: DEFAULT_CONTACT_WHATSAPP };
  }
});

export const adminUpdateContactWhatsapp = createFn({ method: "POST" })
  .validator((input) =>
    z.object({ number: z.string().trim().min(7).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    const value = normalizeWhatsapp(data.number);
    if (value.length < 10) throw new Error("Enter a valid WhatsApp number");
    await apiClient.post("/api/admin/settings", { whatsapp_admin_phone: value });
    return { ok: true, number: value };
  });

// ---------- Media: promo video + dashboard carousel images ----------
export const getSiteMedia = createFn({ method: "GET" }).handler(async () => {
  try {
    const settings = await apiClient.get<any>("/api/settings");
    return {
      video_url: (settings?.promo_video_url ?? "").trim(),
      images: (settings?.dashboard_images ?? []).slice(0, 4),
    };
  } catch {
    return { video_url: "", images: [] };
  }
});

export const adminUpdateSiteMedia = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        video_url: z.string().trim().max(500).default(""),
        images: z.array(z.string().trim().max(500)).max(4).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const cleanImages = data.images.map((s) => s.trim()).filter(Boolean).slice(0, 4);
    await apiClient.post("/api/admin/settings", {
      promo_video_url: data.video_url.trim(),
      dashboard_images: cleanImages,
    });
    return { ok: true, video_url: data.video_url.trim(), images: cleanImages };
  });

// ---------- File uploads (video / images) ----------
export const adminCreateSignedMediaUpload = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        kind: z.enum(["video", "image"]),
        ext: z.string().trim().min(1).max(8).regex(/^[a-z0-9]+$/i),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const safeExt = data.ext.toLowerCase();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    const contentType = data.kind === "video" ? `video/${safeExt}` : `image/${safeExt}`;

    try {
      const presigned = await apiClient.post<{
        upload_url: string;
        public_url: string;
        key: string;
      }>("/api/storage/presigned-url", {
        file_name: filename,
        content_type: contentType,
        folder: "site-media",
      });

      return { path: presigned.upload_url, token: presigned.key };
    } catch {
      return { path: filename, token: filename };
    }
  });

export const adminFinalizeMediaUpload = createFn({ method: "POST" })
  .validator((input) => z.object({ path: z.string().trim().min(1).max(1000) }).parse(input))
  .handler(async ({ data }) => {
    return { url: data.path };
  });
