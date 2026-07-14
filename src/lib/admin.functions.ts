import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFreshXSession } from "@/lib/session.server";

const ServiceItemCategorySchema = z.enum([
  "laundry_soft",
  "laundry_hard",
  "laundry_bedding",
  "cleaning_apartment",
  "cleaning_office",
  "cleaning_other",
  "delivery",
]);

async function requireAdmin(): Promise<string> {
  const session = await getFreshXSession();
  const id = session.data?.profileId;
  if (!id) throw new Error("Not signed in");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.role !== "admin") throw new Error("Admin access required");
  return id;
}

// ============ Orders queue ============
export const adminListOrders = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        status: z.string().optional(),
        start_date: z.string().datetime().optional(),
        end_date: z.string().datetime().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    let q = supabaseAdmin
      .from("orders")
      .select(
        "id, profile_id, service_type, status, subtotal, delivery_fee, discount_amount, total_amount, delivery_method, address, special_instructions, items_json, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(1000);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.start_date) q = q.gte("created_at", data.start_date);
    if (data.end_date) q = q.lte("created_at", data.end_date);
    const { data: orders, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((orders ?? []).map((o) => o.profile_id as string)));
    const { data: profiles } = ids.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, full_name, whatsapp_number")
          .in("id", ids)
      : { data: [] as Array<{ id: string; full_name: string; whatsapp_number: string }> };
    const pmap = new Map((profiles ?? []).map((p) => [p.id as string, p]));

    return (orders ?? []).map((o) => {
      const p = pmap.get(o.profile_id as string);
      const items = ((o.items_json as { items?: Array<{ name: string; quantity: number; line_total: number }> } | null)?.items ?? []);
      return {
        id: o.id as string,
        service_type: o.service_type as string,
        status: o.status as string,
        subtotal: Number(o.subtotal),
        delivery_fee: Number(o.delivery_fee),
        discount_amount: Number(o.discount_amount),
        total_amount: Number(o.total_amount),
        delivery_method: o.delivery_method as string,
        address: (o.address as string | null) ?? null,
        special_instructions: (o.special_instructions as string | null) ?? null,
        created_at: o.created_at as string,
        customer_name: p?.full_name ?? "—",
        customer_whatsapp: p?.whatsapp_number ?? "—",
        item_count: items.length,
        items_summary: items.map((i) => `${i.name} ×${i.quantity}`).join(", "),
        items: items.map((i) => ({
          name: i.name,
          quantity: Number(i.quantity),
          line_total: Number(i.line_total),
        })),
      };
    });
  });

export const adminUpdateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        order_id: z.string().uuid(),
        status: z.enum(["received", "washing", "ready", "delivered", "cancelled"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: o, error } = await supabaseAdmin
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.order_id)
      .select("profile_id")
      .single();
    if (error || !o) throw new Error(error?.message ?? "Order not found");
    await supabaseAdmin.from("notifications").insert({
      profile_id: o.profile_id,
      type: "order_update",
      channel: "in_app",
      message: `Your order is now: ${data.status}.`,
    });
    return { ok: true };
  });

// ============ Service items CRUD ============
export const adminListServiceItems = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("service_items")
    .select("id, category, name, price, is_active, created_at")
    .order("category")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    category: r.category as string,
    name: r.name as string,
    price: Number(r.price),
    is_active: !!r.is_active,
  }));
});

export const adminUpsertServiceItem = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        category: ServiceItemCategorySchema,
        name: z.string().trim().min(1).max(120),
        price: z.number().min(0).max(10_000_000),
        is_active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("service_items")
        .update({
          category: data.category,
          name: data.name,
          price: data.price,
          is_active: data.is_active,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("service_items").insert({
        category: data.category,
        name: data.name,
        price: data.price,
        is_active: data.is_active,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteServiceItem = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("service_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Promo codes CRUD ============
export const adminListPromoCodes = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("promo_codes")
    .select("id, code, type, value, min_order_amount, expiry_date, usage_limit, times_used, is_active, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    code: r.code as string,
    type: r.type as "percentage" | "fixed",
    value: Number(r.value),
    min_order_amount: Number(r.min_order_amount),
    expiry_date: (r.expiry_date as string | null) ?? null,
    usage_limit: (r.usage_limit as number | null) ?? null,
    times_used: Number(r.times_used ?? 0),
    is_active: !!r.is_active,
  }));
});

export const adminUpsertPromoCode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_-]+$/, "Use A-Z, 0-9, _ or -"),
        type: z.enum(["percentage", "fixed"]),
        value: z.number().min(0).max(1_000_000),
        min_order_amount: z.number().min(0).max(10_000_000).default(0),
        expiry_date: z.string().optional().nullable(),
        usage_limit: z.number().int().min(0).optional().nullable(),
        is_active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const patch = {
      code: data.code.toUpperCase(),
      type: data.type,
      value: data.value,
      min_order_amount: data.min_order_amount,
      expiry_date: data.expiry_date || null,
      usage_limit: data.usage_limit ?? null,
      is_active: data.is_active,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("promo_codes").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("promo_codes").insert(patch);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeletePromoCode = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("promo_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Create or update a personal promo code linked to a specific customer.
// The owner earns this same percentage as wallet commission whenever
// someone else uses the code on a Flutterwave top-up.
export const adminUpsertCustomerPromo = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        owner_profile_id: z.string().uuid(),
        code: z.string().trim().min(3).max(40).regex(/^[A-Z0-9_-]+$/i, "Use A-Z, 0-9, _ or -"),
        percentage: z.number().min(1).max(50),
        is_active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const code = data.code.toUpperCase();
    // Ensure this code is not already used by a different owner / different settings
    const { data: existing } = await supabaseAdmin
      .from("promo_codes")
      .select("id, owner_profile_id")
      .ilike("code", code)
      .maybeSingle();

    if (existing && existing.owner_profile_id && existing.owner_profile_id !== data.owner_profile_id) {
      throw new Error("That code is already assigned to another customer.");
    }

    const patch = {
      code,
      type: "percentage" as const,
      value: data.percentage,
      min_order_amount: 0,
      expiry_date: null,
      usage_limit: null,
      is_active: data.is_active,
      owner_profile_id: data.owner_profile_id,
    };

    if (existing) {
      const { error } = await supabaseAdmin.from("promo_codes").update(patch).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("promo_codes").insert(patch);
      if (error) throw new Error(error.message);
    }
    return { ok: true, code };
  });

// List a customer's owned promo code (if any) so the admin can edit it.
export const adminGetCustomerPromo = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ owner_profile_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: rows } = await supabaseAdmin
      .from("promo_codes")
      .select("id, code, type, value, is_active, times_used")
      .eq("owner_profile_id", data.owner_profile_id)
      .order("created_at", { ascending: false })
      .limit(1);
    const r = rows?.[0];
    if (!r) return null;
    return {
      id: r.id as string,
      code: r.code as string,
      percentage: Number(r.value),
      is_active: !!r.is_active,
      times_used: Number(r.times_used ?? 0),
    };
  });

// ============ Customers ============
export const adminListCustomers = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, whatsapp_number, wallet_balance, role, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    full_name: r.full_name as string,
    whatsapp_number: r.whatsapp_number as string,
    wallet_balance: Number(r.wallet_balance ?? 0),
    role: r.role as string,
    created_at: r.created_at as string,
  }));
});

export const adminCreditWallet = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        profile_id: z.string().uuid(),
        amount: z.number().int().min(-1_000_000).max(1_000_000).refine((n) => n !== 0, "Amount cannot be zero"),
        note: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("wallet_balance")
      .eq("id", data.profile_id)
      .single();
    const balance = Number(profile?.wallet_balance ?? 0);
    const newBalance = balance + data.amount;
    if (newBalance < 0) throw new Error("Adjustment would make balance negative.");
    await supabaseAdmin
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq("id", data.profile_id);
    await supabaseAdmin.from("wallet_transactions").insert({
      profile_id: data.profile_id,
      type: data.amount > 0 ? "credit" : "debit",
      amount: Math.abs(data.amount),
      description: data.note ?? (data.amount > 0 ? "Manual credit by admin" : "Manual debit by admin"),
    });
    await supabaseAdmin.from("notifications").insert({
      profile_id: data.profile_id,
      type: "wallet_adjustment",
      channel: "in_app",
      message:
        data.amount > 0
          ? `Wallet credited ₦${data.amount.toLocaleString()}. New balance: ₦${newBalance.toLocaleString()}.`
          : `Wallet debited ₦${Math.abs(data.amount).toLocaleString()}. New balance: ₦${newBalance.toLocaleString()}.`,
    });
    return { ok: true, new_balance: newBalance };
  });

// ============ Reports ============
export const adminReports = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: orders },
    { count: customerCount },
    { data: txns },
    { count: activeOrders },
  ] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("id, total_amount, status, service_type, created_at")
      .gte("created_at", since)
      .limit(1000),
    supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
    supabaseAdmin
      .from("wallet_transactions")
      .select("type, amount, created_at")
      .gte("created_at", since)
      .limit(1000),
    supabaseAdmin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["received", "washing", "ready"]),
  ]);

  const totalRevenue = (orders ?? [])
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total_amount), 0);
  const laundryRevenue = (orders ?? [])
    .filter((o) => o.service_type === "laundry" && o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total_amount), 0);
  const cleaningRevenue = (orders ?? [])
    .filter((o) => o.service_type === "cleaning" && o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total_amount), 0);
  const topups = (txns ?? [])
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + Number(t.amount), 0);

  return {
    total_revenue_30d: totalRevenue,
    laundry_revenue_30d: laundryRevenue,
    cleaning_revenue_30d: cleaningRevenue,
    order_count_30d: (orders ?? []).length,
    topups_30d: topups,
    customers_total: customerCount ?? 0,
    active_orders: activeOrders ?? 0,
  };
});

// Monthly breakdown for a given year (Jan..Dec).
export const adminMonthlyReports = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ year: z.number().int().min(2020).max(2100) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const year = data.year;
    const start = new Date(Date.UTC(year, 0, 1)).toISOString();
    const end = new Date(Date.UTC(year + 1, 0, 1)).toISOString();

    const [{ data: orders }, { data: txns }] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("total_amount, status, service_type, created_at")
        .gte("created_at", start)
        .lt("created_at", end)
        .limit(10000),
      supabaseAdmin
        .from("wallet_transactions")
        .select("type, amount, created_at")
        .gte("created_at", start)
        .lt("created_at", end)
        .limit(10000),
    ]);

    const months = Array.from({ length: 12 }, () => ({
      revenue: 0,
      laundry: 0,
      cleaning: 0,
      orders: 0,
      topups: 0,
    }));

    for (const o of orders ?? []) {
      const m = new Date(o.created_at as string).getUTCMonth();
      months[m].orders += 1;
      if (o.status !== "cancelled") {
        const amt = Number(o.total_amount);
        months[m].revenue += amt;
        if (o.service_type === "laundry") months[m].laundry += amt;
        if (o.service_type === "cleaning") months[m].cleaning += amt;
      }
    }
    for (const t of txns ?? []) {
      if (t.type !== "credit") continue;
      const m = new Date(t.created_at as string).getUTCMonth();
      months[m].topups += Number(t.amount);
    }

    return { year, months };
  });

// ============ Referral codes ============
export const adminListReferralCodes = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("referral_codes")
    .select("id, code, owner_profile_id, reward_amount, times_used, is_active, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const ownerIds = Array.from(
    new Set((data ?? []).map((r) => r.owner_profile_id as string | null).filter(Boolean) as string[]),
  );
  const { data: owners } = ownerIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ownerIds)
    : { data: [] as Array<{ id: string; full_name: string }> };
  const omap = new Map((owners ?? []).map((o) => [o.id as string, o.full_name as string]));
  const codeStrings = (data ?? []).map((r) => (r.code as string).toUpperCase());
  const usageByCode = new Map<string, number>();
  if (codeStrings.length) {
    const { data: referred } = await supabaseAdmin
      .from("profiles")
      .select("referred_by_code")
      .not("referred_by_code", "is", null);
    for (const row of referred ?? []) {
      const k = ((row.referred_by_code as string | null) ?? "").toUpperCase();
      if (!k) continue;
      usageByCode.set(k, (usageByCode.get(k) ?? 0) + 1);
    }
  }
  return (data ?? []).map((r) => {
    const codeUpper = (r.code as string).toUpperCase();
    const actual = usageByCode.get(codeUpper) ?? 0;
    const stored = Number(r.times_used ?? 0);
    return {
      id: r.id as string,
      code: r.code as string,
      owner_profile_id: (r.owner_profile_id as string | null) ?? null,
      owner_name: r.owner_profile_id ? omap.get(r.owner_profile_id as string) ?? "—" : null,
      reward_amount: Number(r.reward_amount ?? 0),
      times_used: Math.max(actual, stored),
      is_active: !!r.is_active,
      created_at: r.created_at as string,
    };
  });
});

export const adminUpsertReferralCode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z
          .string()
          .trim()
          .min(3)
          .max(40)
          .regex(/^[A-Z0-9_-]+$/i, "Use A-Z, 0-9, _ or -"),
        owner_profile_id: z.string().uuid().nullable().optional(),
        reward_amount: z.number().min(0).max(1_000_000).default(0),
        is_active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const patch = {
      code: data.code.toUpperCase(),
      owner_profile_id: data.owner_profile_id ?? null,
      reward_amount: data.reward_amount,
      is_active: data.is_active,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("referral_codes").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("referral_codes").insert(patch);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteReferralCode = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("referral_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetCustomerReferral = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ owner_profile_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: rows } = await supabaseAdmin
      .from("referral_codes")
      .select("id, code, reward_amount, is_active, times_used")
      .eq("owner_profile_id", data.owner_profile_id)
      .order("created_at", { ascending: false })
      .limit(1);
    const r = rows?.[0];
    if (!r) return null;
    return {
      id: r.id as string,
      code: r.code as string,
      reward_amount: Number(r.reward_amount ?? 0),
      is_active: !!r.is_active,
      times_used: Number(r.times_used ?? 0),
    };
  });

export const adminUpsertCustomerReferral = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        owner_profile_id: z.string().uuid(),
        code: z.string().trim().min(3).max(40).regex(/^[A-Z0-9_-]+$/i),
        reward_amount: z.number().min(0).max(1_000_000).default(0),
        is_active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const code = data.code.toUpperCase();
    const { data: existing } = await supabaseAdmin
      .from("referral_codes")
      .select("id, owner_profile_id")
      .ilike("code", code)
      .maybeSingle();
    if (existing && existing.owner_profile_id && existing.owner_profile_id !== data.owner_profile_id) {
      throw new Error("That referral code is already assigned to another customer.");
    }
    const patch = {
      code,
      owner_profile_id: data.owner_profile_id,
      reward_amount: data.reward_amount,
      is_active: data.is_active,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      const { error } = await supabaseAdmin.from("referral_codes").update(patch).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("referral_codes").insert(patch);
      if (error) throw new Error(error.message);
    }
    return { ok: true, code };
  });

// ============ Admin role management ============
// Search users by name / WhatsApp / email so an admin can promote them.
export const adminSearchUsers = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ q: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const like = `%${data.q}%`;
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, whatsapp_number, email, role")
      .or(`full_name.ilike.${like},whatsapp_number.ilike.${like},email.ilike.${like}`)
      .limit(20);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      full_name: (r.full_name as string) ?? "",
      whatsapp_number: (r.whatsapp_number as string) ?? "",
      email: ((r as { email?: string | null }).email as string | null) ?? null,
      role: (r.role as string) ?? "user",
    }));
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        profile_id: z.string().uuid(),
        role: z.enum(["admin", "user"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const callerId = await requireAdmin();
    if (data.role === "user" && data.profile_id === callerId) {
      throw new Error("You can't remove your own admin access.");
    }
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ role: data.role })
      .eq("id", data.profile_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

