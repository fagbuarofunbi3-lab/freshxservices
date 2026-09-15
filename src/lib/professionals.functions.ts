import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import { getMe } from "@/lib/auth.functions";
import { createFn } from "@/lib/create-fn";

export const PRO_CATEGORIES = [
  { value: "hairdressing", label: "Hairdressing" },
  { value: "barbering", label: "Barbering" },
  { value: "hygiene", label: "Hygiene Products" },
  { value: "gas_refill", label: "Gas Refill" },
  { value: "accommodation", label: "Accommodation" },
] as const;

const CategorySchema = z.enum([
  "hairdressing",
  "barbering",
  "hygiene",
  "gas_refill",
  "accommodation",
]);

// Upload image using Go backend Cloudflare R2 presigned URL or direct upload
export const uploadProfessionalImage = createFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        data_url: z.string().min(20).max(15 * 1024 * 1024),
        kind: z.enum(["logo", "catalog"]),
        filename: z.string().trim().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const match = data.data_url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) throw new Error("Please pick a valid image file.");
    const mime = match[1];
    const ext = mime.split("/")[1] || "jpg";
    const filename = data.filename || `pro-${Date.now()}.${ext}`;

    try {
      const blob = await (await fetch(data.data_url)).blob();

      // Request presigned URL from Go backend
      const presigned = await apiClient.post<{
        upload_url: string;
        public_url: string;
        key: string;
      }>("/api/storage/presigned-url", {
        file_name: filename,
        content_type: mime,
        folder: `professionals/${data.kind}`,
      });

      // Upload binary to R2
      await fetch(presigned.upload_url, {
        method: "PUT",
        headers: { "Content-Type": mime },
        body: blob,
      });

      return { path: presigned.key, url: presigned.public_url };
    } catch {
      // Fallback: return data url if R2 is not configured
      return { path: filename, url: data.data_url };
    }
  });

export const adminPromoteProfessional = createFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        profile_id: z.string().min(1),
        category: CategorySchema,
        business_name: z.string().trim().min(2).max(80),
        whatsapp_number: z.string().trim().max(30).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const res = await apiClient.post<{ slug: string }>("/api/admin/professionals/promote", data);
    return { ok: true, slug: res.slug };
  });

export const adminListProfessionals = createFn({ method: "GET" }).handler(
  async () => {
    const list = await apiClient.get<any[]>("/api/admin/professionals");
    return (list ?? []).map((p) => ({
      id: (p.id || p._id) as string,
      profile_id: (p.profile_id || p.profileId) as string,
      category: p.category as any,
      business_name: p.business_name as string,
      slug: p.slug as string,
      whatsapp_number: (p.whatsapp_number ?? "") as string,
      is_active: Boolean(p.is_active),
      created_at: (p.created_at as string) ?? new Date().toISOString(),
      owner_name: (p.owner_name ?? "Customer") as string,
      item_count: (p.catalog_items ?? []).length,
      review_count: p.review_count ?? 0,
      avg_rating: p.average_rating ?? 0,
    }));
  },
);

export const adminDeleteProfessional = createFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    await apiClient.delete(`/api/admin/professionals/${data.id}`);
    return { ok: true };
  });

export const getMyProfessional = createFn({ method: "GET" }).handler(async () => {
  try {
    const p = await apiClient.get<any>("/api/professionals/me");
    if (!p) return null;
    return {
      id: (p.id || p._id) as string,
      category: p.category as any,
      business_name: p.business_name as string,
      slug: p.slug as string,
      whatsapp_number: (p.whatsapp_number ?? "") as string,
      is_active: Boolean(p.is_active),
      logo_url: (p.logo_url ?? "") as string,
      logo_display_url: (p.logo_url ?? "") as string,
      items: (p.catalog_items ?? []).map((it: any) => ({
        id: (it.id || it._id) as string,
        image_url: it.image_url as string,
        image_src: it.image_url as string,
        image_display_url: it.image_url as string,
        title: it.title as string,
        price: Number(it.price ?? 0),
        position: Number(it.position ?? 0),
      })),
      reviews: (p.reviews ?? []).map((r: any) => ({
        id: (r.id || r._id) as string,
        reviewer_name: (r.reviewer_name ?? "Anonymous") as string,
        rating: Number(r.rating ?? 5),
        comment: (r.comment ?? "") as string,
        created_at: (r.created_at as string) ?? new Date().toISOString(),
      })),
      avg_rating: p.average_rating ?? 0,
    };
  } catch {
    return null;
  }
});

export const updateMyProfessional = createFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        business_name: z.string().trim().min(2).max(80).optional(),
        whatsapp_number: z.string().trim().max(30).optional(),
        category: CategorySchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/professionals/me", data);
    return { ok: true };
  });

export const upsertMyCatalogItem = createFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().min(1).optional(),
        image_url: z.string().trim().min(1),
        title: z.string().trim().min(1).max(100),
        price: z.number().nonnegative(),
        position: z.number().int().min(0).max(7).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const res = await apiClient.post<any>("/api/professionals/items", data);
    return { ok: true, id: (res.id || res._id) as string };
  });

export const deleteMyCatalogItem = createFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    await apiClient.delete(`/api/professionals/items/${data.id}`);
    return { ok: true };
  });

export const listProfessionalsByCategory = createFn({ method: "GET" })
  .inputValidator((input) => z.object({ category: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const list = await apiClient.get<any[]>(`/api/professionals?category=${data.category}`);
    return (list ?? []).map((p) => {
      const items = (p.catalog_items ?? []).map((it: any) => ({
        id: (it.id || it._id) as string,
        image_url: it.image_url as string,
        image_src: it.image_url as string,
        image_display_url: it.image_url as string,
        title: it.title as string,
        price: Number(it.price ?? 0),
        position: Number(it.position ?? 0),
      }));
      return {
        id: (p.id || p._id) as string,
        category: p.category as any,
        business_name: p.business_name as string,
        slug: p.slug as string,
        whatsapp_number: (p.whatsapp_number ?? "") as string,
        owner_name: (p.owner_name ?? "Professional") as string,
        logo_url: items[0]?.image_src ?? "",
        avg_rating: p.average_rating ?? 0,
        review_count: p.review_count ?? 0,
        catalog_images: items.map((it: any) => it.image_src).filter(Boolean),
        preview_items: items.slice(0, 3),
      };
    });
  });

export const getProfessionalBySlug = createFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    try {
      const p = await apiClient.get<any>(`/api/professionals/${data.slug}`);
      if (!p) return null;
      const items = (p.catalog_items ?? []).map((it: any) => ({
        id: (it.id || it._id) as string,
        image_url: it.image_url as string,
        image_src: it.image_url as string,
        image_display_url: it.image_url as string,
        title: it.title as string,
        price: Number(it.price ?? 0),
        position: Number(it.position ?? 0),
      }));
      const reviews = (p.reviews ?? []).map((r: any) => ({
        id: (r.id || r._id) as string,
        reviewer_name: (r.reviewer_name ?? "Customer") as string,
        rating: Number(r.rating ?? 5),
        comment: (r.comment ?? "") as string,
        created_at: (r.created_at as string) ?? new Date().toISOString(),
      }));

      return {
        id: (p.id || p._id) as string,
        profile_id: (p.profile_id || p.profileId) as string,
        category: p.category as any,
        business_name: p.business_name as string,
        slug: p.slug as string,
        whatsapp_number: (p.whatsapp_number ?? "") as string,
        owner_name: (p.owner_name ?? "Professional") as string,
        logo_url: items[0]?.image_src ?? "",
        items,
        reviews,
        avg_rating: p.average_rating ?? 0,
        review_count: reviews.length,
      };
    } catch {
      return null;
    }
  });

export const submitReview = createFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        professional_id: z.string().min(1),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(500).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post(`/api/professionals/${data.professional_id}/reviews`, {
      rating: data.rating,
      comment: data.comment,
    });
    return { ok: true };
  });

export const getMyDisplayName = createFn({ method: "GET" }).handler(async () => {
  const me = await getMe();
  return me ? { full_name: me.full_name } : null;
});
