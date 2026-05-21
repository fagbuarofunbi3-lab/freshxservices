import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFreshXSession } from "@/lib/session.server";

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
    z.object({ status: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    let q = supabaseAdmin
      .from("orders")
      .select(
        "id, profile_id, service_type, status, total_amount, delivery_method, address, created_at, items_json",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
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
      return {
        id: o.id as string,
        service_type: o.service_type as string,
        status: o.status as string,
        total_amount: Number(o.total_amount),
        delivery_method: o.delivery_method as string,
        address: (o.address as string | null) ?? null,
        created_at: o.created_at as string,
        customer_name: p?.full_name ?? "—",
        customer_whatsapp: p?.whatsapp_number ?? "—",
        item_count:
          ((o.items_json as { items?: unknown[] } | null)?.items ?? []).length,
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
        category: z.enum(["laundry", "cleaning"]),
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
