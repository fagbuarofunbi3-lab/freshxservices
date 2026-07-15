import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFreshXSession } from "@/lib/session.server";

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

const BUCKET = "professional-media";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

async function requireSession(): Promise<string> {
  const session = await getFreshXSession();
  const id = session.data?.profileId;
  if (!id) throw new Error("Not signed in");
  return id;
}

async function requireAdmin(): Promise<string> {
  const id = await requireSession();
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.role !== "admin") throw new Error("Admin access required");
  return id;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "shop"
  );
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  for (let i = 0; i < 6; i++) {
    const { data } = await supabaseAdmin
      .from("professionals")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${slugify(base)}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return `${slugify(base)}-${Date.now().toString(36)}`;
}

// Resolve a stored value into a URL a browser can load.
// - full http(s) URL → returned as-is (back-compat with previous URL entries)
// - storage path → signed URL from the private bucket
async function resolveMediaUrl(pathOrUrl: string | null | undefined): Promise<string> {
  const v = (pathOrUrl ?? "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(v, SIGNED_URL_TTL);
  return data?.signedUrl ?? "";
}

async function resolveMediaMap(paths: Array<string | null | undefined>): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(paths.map((p) => (p ?? "").trim()).filter(Boolean)));
  await Promise.all(
    unique.map(async (p) => {
      map.set(p, await resolveMediaUrl(p));
    }),
  );
  return map;
}

// ============ Upload ============
export const uploadProfessionalImage = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        // Data URL: "data:image/jpeg;base64,...."
        data_url: z.string().min(20).max(15 * 1024 * 1024), // ~15MB base64
        kind: z.enum(["logo", "catalog"]),
        filename: z.string().trim().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const profileId = await requireSession();
    const { data: pro } = await supabaseAdmin
      .from("professionals")
      .select("id")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (!pro) throw new Error("You are not a professional.");

    const match = data.data_url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) throw new Error("Please pick a valid image file.");
    const mime = match[1];
    const b64 = match[2];
    const buf = Buffer.from(b64, "base64");
    if (buf.byteLength > 8 * 1024 * 1024) {
      throw new Error("Image too large. Please pick something under 8MB.");
    }
    const ext =
      mime === "image/png"
        ? "png"
        : mime === "image/webp"
          ? "webp"
          : mime === "image/gif"
            ? "gif"
            : "jpg";
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `${data.kind}/${pro.id}/${id}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: mime, upsert: false });
    if (error) throw new Error(error.message);

    const url = await resolveMediaUrl(path);
    return { path, url };
  });

// ============ Admin: promote / list / delete ============
export const adminPromoteProfessional = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        profile_id: z.string().uuid(),
        category: CategorySchema,
        business_name: z.string().trim().min(2).max(80),
        whatsapp_number: z.string().trim().max(30).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: existing } = await supabaseAdmin
      .from("professionals")
      .select("id")
      .eq("profile_id", data.profile_id)
      .maybeSingle();
    if (existing) throw new Error("This customer is already a professional.");
    const slug = await uniqueSlug(data.business_name);
    const { error } = await supabaseAdmin.from("professionals").insert({
      profile_id: data.profile_id,
      category: data.category,
      business_name: data.business_name,
      whatsapp_number: data.whatsapp_number ?? "",
      slug,
      is_active: true,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("notifications").insert({
      profile_id: data.profile_id,
      channel: "in_app",
      type: "professional",
      message: `You are now a FreshX Professional! Set up your shop from your dashboard.`,
    });
    return { ok: true, slug };
  });

export const adminListProfessionals = createServerFn({ method: "GET" }).handler(
  async () => {
    await requireAdmin();
    const { data, error } = await supabaseAdmin
      .from("professionals")
      .select("id, profile_id, category, business_name, slug, whatsapp_number, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).map((p) => p.profile_id as string)));
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, whatsapp_number").in("id", ids)
      : { data: [] as Array<{ id: string; full_name: string; whatsapp_number: string }> };
    const pmap = new Map((profiles ?? []).map((p) => [p.id as string, p]));
    return (data ?? []).map((r) => ({
      id: r.id as string,
      profile_id: r.profile_id as string,
      category: r.category as string,
      business_name: r.business_name as string,
      slug: r.slug as string,
      whatsapp_number: r.whatsapp_number as string,
      is_active: !!r.is_active,
      owner_name: pmap.get(r.profile_id as string)?.full_name ?? "—",
    }));
  },
);

export const adminDeleteProfessional = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("professionals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Owner (self-service) ============
export const getMyProfessional = createServerFn({ method: "GET" }).handler(async () => {
  const id = await requireSession();
  const { data: pro } = await supabaseAdmin
    .from("professionals")
    .select("id, category, business_name, slug, whatsapp_number, is_active, logo_url")
    .eq("profile_id", id)
    .maybeSingle();
  if (!pro) return null;
  const { data: items } = await supabaseAdmin
    .from("professional_catalog_items")
    .select("id, image_url, title, price, position")
    .eq("professional_id", pro.id)
    .order("position", { ascending: true });
  const media = await resolveMediaMap([
    pro.logo_url as string | null,
    ...(items ?? []).map((i) => i.image_url as string | null),
  ]);
  return {
    id: pro.id as string,
    category: pro.category as string,
    business_name: pro.business_name as string,
    slug: pro.slug as string,
    whatsapp_number: pro.whatsapp_number as string,
    is_active: !!pro.is_active,
    logo_url: (pro.logo_url as string | null) ?? "",
    logo_display_url: media.get(((pro.logo_url as string | null) ?? "").trim()) ?? "",
    items: (items ?? []).map((i) => ({
      id: i.id as string,
      image_url: (i.image_url as string) ?? "",
      image_display_url: media.get(((i.image_url as string | null) ?? "").trim()) ?? "",
      title: (i.title as string) ?? "",
      price: Number(i.price ?? 0),
      position: Number(i.position ?? 0),
    })),
  };
});

export const updateMyProfessional = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        business_name: z.string().trim().min(2).max(80),
        whatsapp_number: z.string().trim().max(30),
        is_active: z.boolean().default(true),
        logo_url: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const id = await requireSession();
    const patch: {
      business_name: string;
      whatsapp_number: string;
      is_active: boolean;
      logo_url?: string;
    } = {
      business_name: data.business_name,
      whatsapp_number: data.whatsapp_number,
      is_active: data.is_active,
    };
    if (typeof data.logo_url === "string") patch.logo_url = data.logo_url;
    const { error } = await supabaseAdmin
      .from("professionals")
      .update(patch)
      .eq("profile_id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertMyCatalogItem = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        image_url: z.string().trim().max(1000).default(""),
        title: z.string().trim().min(1).max(120),
        price: z.number().min(0).max(10_000_000),
        position: z.number().int().min(0).max(100).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const id = await requireSession();
    const { data: pro } = await supabaseAdmin
      .from("professionals")
      .select("id")
      .eq("profile_id", id)
      .maybeSingle();
    if (!pro) throw new Error("You are not a professional.");
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("professional_catalog_items")
        .update({
          image_url: data.image_url,
          title: data.title,
          price: data.price,
          position: data.position,
        })
        .eq("id", data.id)
        .eq("professional_id", pro.id);
      if (error) throw new Error(error.message);
    } else {
      const { count } = await supabaseAdmin
        .from("professional_catalog_items")
        .select("*", { count: "exact", head: true })
        .eq("professional_id", pro.id);
      if ((count ?? 0) >= 8) throw new Error("Catalog is limited to 8 items.");
      const { error } = await supabaseAdmin.from("professional_catalog_items").insert({
        professional_id: pro.id,
        image_url: data.image_url,
        title: data.title,
        price: data.price,
        position: data.position,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteMyCatalogItem = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const id = await requireSession();
    const { data: pro } = await supabaseAdmin
      .from("professionals")
      .select("id")
      .eq("profile_id", id)
      .maybeSingle();
    if (!pro) throw new Error("You are not a professional.");
    const { error } = await supabaseAdmin
      .from("professional_catalog_items")
      .delete()
      .eq("id", data.id)
      .eq("professional_id", pro.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Public browse / shop ============
export const listProfessionalsByCategory = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ category: CategorySchema }).parse(input))
  .handler(async ({ data }) => {
    await requireSession();
    const { data: pros, error } = await supabaseAdmin
      .from("professionals")
      .select("id, business_name, slug, category, whatsapp_number, logo_url")
      .eq("category", data.category)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (pros ?? []).map((p) => p.id as string);
    const [{ data: items }, { data: reviews }] = await Promise.all([
      ids.length
        ? supabaseAdmin
            .from("professional_catalog_items")
            .select("professional_id, image_url")
            .in("professional_id", ids)
            .order("position", { ascending: true })
        : Promise.resolve({ data: [] as Array<{ professional_id: string; image_url: string }> }),
      ids.length
        ? supabaseAdmin
            .from("professional_reviews")
            .select("professional_id, rating")
            .in("professional_id", ids)
        : Promise.resolve({ data: [] as Array<{ professional_id: string; rating: number }> }),
    ]);
    const coverPathMap = new Map<string, string>();
    for (const it of items ?? []) {
      const pid = it.professional_id as string;
      if (!coverPathMap.has(pid) && it.image_url) coverPathMap.set(pid, it.image_url as string);
    }
    const rMap = new Map<string, { sum: number; n: number }>();
    for (const r of reviews ?? []) {
      const pid = r.professional_id as string;
      const cur = rMap.get(pid) ?? { sum: 0, n: 0 };
      cur.sum += Number(r.rating);
      cur.n += 1;
      rMap.set(pid, cur);
    }
    const media = await resolveMediaMap([
      ...(pros ?? []).map((p) => p.logo_url as string | null),
      ...Array.from(coverPathMap.values()),
    ]);
    return (pros ?? []).map((p) => {
      const rm = rMap.get(p.id as string);
      const coverPath = coverPathMap.get(p.id as string) ?? "";
      const logoPath = ((p.logo_url as string | null) ?? "").trim();
      return {
        id: p.id as string,
        business_name: p.business_name as string,
        slug: p.slug as string,
        category: p.category as string,
        whatsapp_number: p.whatsapp_number as string,
        cover_image: media.get(coverPath) ?? "",
        logo_url: media.get(logoPath) ?? "",
        avg_rating: rm && rm.n ? rm.sum / rm.n : 0,
        review_count: rm?.n ?? 0,
      };
    });
  });

export const getProfessionalBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().trim().min(1) }).parse(input))
  .handler(async ({ data }) => {
    await requireSession();
    const { data: pro } = await supabaseAdmin
      .from("professionals")
      .select("id, business_name, slug, category, whatsapp_number, is_active, logo_url")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!pro || !pro.is_active) return null;
    const [{ data: items }, { data: reviews }] = await Promise.all([
      supabaseAdmin
        .from("professional_catalog_items")
        .select("id, image_url, title, price, position")
        .eq("professional_id", pro.id)
        .order("position", { ascending: true }),
      supabaseAdmin
        .from("professional_reviews")
        .select("id, reviewer_profile_id, rating, comment, created_at")
        .eq("professional_id", pro.id)
        .order("created_at", { ascending: false }),
    ]);
    const reviewerIds = Array.from(
      new Set((reviews ?? []).map((r) => r.reviewer_profile_id as string)),
    );
    const { data: reviewers } = reviewerIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", reviewerIds)
      : { data: [] as Array<{ id: string; full_name: string }> };
    const rmap = new Map((reviewers ?? []).map((r) => [r.id as string, r.full_name as string]));
    const rs = reviews ?? [];
    const avg = rs.length ? rs.reduce((s, r) => s + Number(r.rating), 0) / rs.length : 0;
    const media = await resolveMediaMap([
      pro.logo_url as string | null,
      ...(items ?? []).map((i) => i.image_url as string | null),
    ]);
    return {
      id: pro.id as string,
      business_name: pro.business_name as string,
      slug: pro.slug as string,
      category: pro.category as string,
      whatsapp_number: pro.whatsapp_number as string,
      logo_url: media.get(((pro.logo_url as string | null) ?? "").trim()) ?? "",
      items: (items ?? []).map((i) => ({
        id: i.id as string,
        image_url: media.get(((i.image_url as string | null) ?? "").trim()) ?? "",
        title: (i.title as string) ?? "",
        price: Number(i.price ?? 0),
      })),
      reviews: rs.map((r) => ({
        id: r.id as string,
        rating: Number(r.rating),
        comment: (r.comment as string) ?? "",
        created_at: r.created_at as string,
        reviewer_name: rmap.get(r.reviewer_profile_id as string) ?? "Customer",
      })),
      avg_rating: avg,
      review_count: rs.length,
    };
  });

export const submitReview = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        professional_id: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(500).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const id = await requireSession();
    const { data: existing } = await supabaseAdmin
      .from("professional_reviews")
      .select("id")
      .eq("professional_id", data.professional_id)
      .eq("reviewer_profile_id", id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin
        .from("professional_reviews")
        .update({ rating: data.rating, comment: data.comment })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("professional_reviews").insert({
        professional_id: data.professional_id,
        reviewer_profile_id: id,
        rating: data.rating,
        comment: data.comment,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// Fetch current user's display name (for prefilling the contact message)
export const getMyDisplayName = createServerFn({ method: "GET" }).handler(async () => {
  const id = await requireSession();
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", id)
    .maybeSingle();
  return { full_name: (data?.full_name as string | null) ?? "" };
});
