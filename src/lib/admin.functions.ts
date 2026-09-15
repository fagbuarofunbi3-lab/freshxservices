import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { apiClient } from "@/lib/api-client";

const ServiceItemCategorySchema = z.enum([
  "laundry_soft",
  "laundry_hard",
  "laundry_bedding",
  "cleaning_apartment",
  "cleaning_office",
  "cleaning_other",
  "delivery",
]);

// ============ Orders queue ============
export const adminListOrders = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        status: z.string().optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const params = new URLSearchParams();
    if (data.status && data.status !== "all") params.set("status", data.status);
    if (data.start_date) params.set("start_date", data.start_date);
    if (data.end_date) params.set("end_date", data.end_date);

    const qs = params.toString() ? `?${params.toString()}` : "";
    const orders = await apiClient.get<any[]>(`/api/admin/orders${qs}`);

    return (orders ?? []).map((o) => {
      const items = (o.items_json?.items ?? o.items ?? []) as Array<{ name: string; quantity: number; line_total: number }>;
      return {
        id: (o.id || o._id) as string,
        service_type: o.service_type as string,
        status: o.status as string,
        subtotal: Number(o.subtotal ?? 0),
        delivery_fee: Number(o.delivery_fee ?? 0),
        discount_amount: Number(o.discount_amount ?? 0),
        total_amount: Number(o.total_amount ?? 0),
        delivery_method: (o.delivery_method as string) ?? "dropoff",
        address: (o.address as string | null) ?? null,
        special_instructions: (o.special_instructions as string | null) ?? null,
        created_at: (o.created_at as string) ?? new Date().toISOString(),
        customer_name: (o.customer_name ?? "—") as string,
        customer_whatsapp: (o.customer_whatsapp ?? "—") as string,
        item_count: items.length,
        items_summary: items.map((i) => `${i.name} ×${i.quantity}`).join(", "),
        items: items.map((i) => ({
          name: i.name,
          quantity: Number(i.quantity ?? 1),
          line_total: Number(i.line_total ?? 0),
        })),
      };
    });
  });

export const adminUpdateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        order_id: z.string().min(1),
        status: z.enum(["received", "washing", "ready", "delivered", "cancelled"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/admin/orders/status", {
      order_id: data.order_id,
      status: data.status,
    });
    return { ok: true };
  });

// ============ Service items CRUD ============
export const adminListServiceItems = createServerFn({ method: "GET" }).handler(async () => {
  const items = await apiClient.get<any[]>("/api/admin/services");
  return (items ?? []).map((r) => ({
    id: (r.id || r._id) as string,
    category: r.category as string,
    name: r.name as string,
    price: Number(r.price ?? 0),
    is_active: Boolean(r.is_active),
  }));
});

export const adminUpsertServiceItem = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().min(1).optional(),
        category: ServiceItemCategorySchema,
        name: z.string().trim().min(1).max(120),
        price: z.number().min(0).max(10_000_000),
        is_active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/admin/services", data);
    return { ok: true };
  });

export const adminDeleteServiceItem = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    await apiClient.delete(`/api/admin/services/${data.id}`);
    return { ok: true };
  });

// ============ Promo codes CRUD ============
export const adminListPromoCodes = createServerFn({ method: "GET" }).handler(async () => {
  const promos = await apiClient.get<any[]>("/api/admin/promos");
  return (promos ?? []).map((r) => ({
    id: (r.id || r._id) as string,
    code: r.code as string,
    type: r.type as "percentage" | "fixed",
    value: Number(r.value ?? 0),
    min_order_amount: Number(r.min_order_amount ?? 0),
    expiry_date: (r.expiry_date as string | null) ?? null,
    usage_limit: (r.usage_limit as number | null) ?? null,
    times_used: Number(r.times_used ?? 0),
    is_active: Boolean(r.is_active),
  }));
});

export const adminUpsertPromoCode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().min(1).optional(),
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
    await apiClient.post("/api/admin/promos", {
      id: data.id,
      code: data.code.toUpperCase(),
      type: data.type,
      value: data.value,
      min_order_amount: data.min_order_amount,
      expiry_date: data.expiry_date || null,
      usage_limit: data.usage_limit ?? null,
      is_active: data.is_active,
    });
    return { ok: true };
  });

export const adminDeletePromoCode = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    await apiClient.delete(`/api/admin/promos/${data.id}`);
    return { ok: true };
  });

export const adminUpsertCustomerPromo = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        customer_id: z.string().min(1),
        code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_-]+$/, "Use A-Z, 0-9, _ or -"),
        percentage: z.number().min(1).max(100),
        min_topup_amount: z.number().min(0).max(10_000_000).default(0),
        is_active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/admin/promos", {
      code: data.code.toUpperCase(),
      type: "percentage",
      value: data.percentage,
      min_order_amount: data.min_topup_amount,
      is_active: data.is_active,
      owner_profile_id: data.customer_id,
    });
    return { ok: true };
  });

export const adminGetCustomerPromo = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ customer_id: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    try {
      const promos = await apiClient.get<any[]>("/api/admin/promos");
      const found = promos.find((p) => p.owner_profile_id === data.customer_id && p.is_active);
      if (!found) return null;
      return {
        id: (found.id || found._id) as string,
        code: found.code as string,
        percentage: Number(found.value ?? 0),
        min_topup_amount: Number(found.min_order_amount ?? 0),
        times_used: Number(found.times_used ?? 0),
        is_active: Boolean(found.is_active),
      };
    } catch {
      return null;
    }
  });

// ============ Customers directory ============
export const adminListCustomers = createServerFn({ method: "GET" }).handler(async () => {
  const customers = await apiClient.get<any[]>("/api/admin/customers");
  return (customers ?? []).map((c) => ({
    id: (c.id || c._id) as string,
    full_name: c.full_name as string,
    whatsapp_number: c.whatsapp_number as string,
    wallet_balance: Number(c.wallet_balance ?? 0),
    role: c.role as "customer" | "admin",
    created_at: (c.created_at as string) ?? new Date().toISOString(),
  }));
});

export const adminCreditWallet = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        profile_id: z.string().min(1),
        amount: z.number().refine((n) => n !== 0, "Amount cannot be zero"),
        note: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const res = await apiClient.post<{ ok: boolean; new_balance: number }>("/api/admin/customers/credit", data);
    return { ok: true, new_balance: res.new_balance };
  });

// ============ Reports / Analytics ============
export const adminReports = createServerFn({ method: "GET" }).handler(async () => {
  const reports = await apiClient.get<any>("/api/admin/reports");
  const totalRev = Number(reports.total_revenue ?? 0);
  const totalOrders = Number(reports.total_orders ?? 0);
  const completedOrders = Number(reports.completed_orders ?? 0);
  const totalCustomers = Number(reports.total_customers ?? 0);
  return {
    total_revenue: totalRev,
    total_revenue_30d: totalRev,
    total_orders: totalOrders,
    order_count_30d: totalOrders,
    completed_orders: completedOrders,
    active_orders: Math.max(0, totalOrders - completedOrders),
    total_customers: totalCustomers,
    customers_total: totalCustomers,
    laundry_revenue: Number(reports.laundry_revenue ?? 0),
    cleaning_revenue: Number(reports.cleaning_revenue ?? 0),
    total_delivery_fees: Number(reports.total_delivery_fees ?? 0),
    daily_revenue: (reports.daily_revenue ?? []).map((d: any) => ({
      date: d.date as string,
      revenue: Number(d.revenue ?? 0),
      orders: Number(d.orders ?? 0),
    })),
  };
});

export const adminMonthlyReports = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ year: z.number().int().min(2020).max(2100) }).parse(input),
  )
  .handler(async ({ data }) => {
    const res = await apiClient.get<{
      year: number;
      months: Array<{
        revenue: number;
        laundry: number;
        cleaning: number;
        orders: number;
        topups: number;
      }>;
    }>(`/api/admin/reports/monthly?year=${data.year}`);
    return res;
  });

// ============ Referral program admin ============
export const adminListReferralCodes = createServerFn({ method: "GET" }).handler(async () => {
  const codes = await apiClient.get<any[]>("/api/admin/referrals");
  return (codes ?? []).map((c) => ({
    id: (c.id || c._id) as string,
    code: c.code as string,
    owner_profile_id: (c.owner_profile_id || c.ownerProfileId || null) as string | null,
    owner_name: (c.owner_name ?? "Ambassador") as string,
    reward_amount: Number(c.reward_amount ?? 0),
    times_used: Number(c.times_used ?? 0),
    is_active: Boolean(c.is_active),
    created_at: (c.created_at as string) ?? new Date().toISOString(),
  }));
});

export const adminUpsertReferralCode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().min(1).optional(),
        code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_-]+$/, "Use A-Z, 0-9, _ or -"),
        owner_profile_id: z.string().min(1).optional().nullable(),
        reward_amount: z.number().min(0).max(1_000_000).default(0),
        is_active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/admin/referrals", {
      id: data.id,
      code: data.code.toUpperCase(),
      owner_profile_id: data.owner_profile_id || undefined,
      reward_amount: data.reward_amount,
      is_active: data.is_active,
    });
    return { ok: true };
  });

export const adminDeleteReferralCode = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    await apiClient.delete(`/api/admin/referrals/${data.id}`);
    return { ok: true };
  });

export const adminGetCustomerReferral = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ customer_id: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    try {
      const code = await apiClient.get<any>(`/api/admin/customers/${data.customer_id}/referral`);
      if (!code) return null;
      return {
        id: (code.id || code._id) as string,
        code: code.code as string,
        reward_amount: Number(code.reward_amount ?? 0),
        times_used: Number(code.times_used ?? 0),
        is_active: Boolean(code.is_active),
      };
    } catch {
      return null;
    }
  });

export const adminUpsertCustomerReferral = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        customer_id: z.string().min(1),
        code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_-]+$/, "Use A-Z, 0-9, _ or -"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post(`/api/admin/customers/${data.customer_id}/referral`, {
      code: data.code.toUpperCase(),
    });
    return { ok: true };
  });

export const adminSearchUsers = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        query: z.string().trim().max(100).default(""),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const qs = data.query ? `?q=${encodeURIComponent(data.query)}` : "";
    const users = await apiClient.get<any[]>(`/api/admin/users/search${qs}`);
    return (users ?? []).map((u) => ({
      id: (u.id || u._id) as string,
      full_name: u.full_name as string,
      whatsapp_number: u.whatsapp_number as string,
      email: (u.email ?? null) as string | null,
      role: u.role as "customer" | "admin",
      wallet_balance: Number(u.wallet_balance ?? 0),
      created_at: (u.created_at as string) ?? new Date().toISOString(),
    }));
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        user_id: z.string().min(1),
        role: z.enum(["customer", "admin"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post(`/api/admin/users/${data.user_id}/role`, {
      role: data.role,
    });
    return { ok: true };
  });
