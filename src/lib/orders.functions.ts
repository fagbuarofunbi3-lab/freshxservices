import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import { createFn } from "@/lib/create-fn";

export const listServiceItems = createFn({ method: "GET" }).handler(async () => {
  const data = await apiClient.get<any[]>("/api/services");
  return (data ?? []).map((r) => ({
    id: r.id as string,
    category: r.category as string,
    name: r.name as string,
    price: Number(r.price),
  }));
});

const OrderItemSchema = z.object({
  service_item_id: z.string().min(1),
  name: z.string().min(1).max(200),
  unit_price: z.number().nonnegative(),
  quantity: z.number().int().min(1).max(200),
});

const CreateOrderSchema = z.object({
  service_type: z.enum(["laundry", "cleaning", "pest_control"]),
  items: z.array(OrderItemSchema).min(1).max(60),
  delivery_method: z.enum(["dropoff", "pickup"]),
  address: z.string().trim().max(300).optional(),
  special_instructions: z.string().trim().max(500).optional(),
  promo_code: z.string().trim().max(40).optional(),
  delivery_fee: z.number().min(0).max(50000).default(0),
  preferred_date: z.string().trim().max(40).optional(),
  preferred_time: z.string().trim().max(40).optional(),
  space_type: z.string().trim().max(80).optional(),
  recurring: z.string().trim().max(40).optional(),
  transaction_pin: z.string().regex(/^\d{4}$/, "Enter your 4-digit PIN"),
});

export const applyPromo = createFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ code: z.string().trim().min(1).max(40), subtotal: z.number().min(0) }).parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const res = await apiClient.post<{
        ok: boolean;
        promo_id?: string;
        code?: string;
        discount?: number;
        message?: string;
      }>("/api/promo/apply", {
        code: data.code.toUpperCase(),
        subtotal: data.subtotal,
      });

      if (!res.ok) {
        return { ok: false as const, message: res.message || "Invalid promo code" };
      }

      return {
        ok: true as const,
        promo_id: res.promo_id ?? "",
        code: res.code ?? data.code.toUpperCase(),
        discount: Number(res.discount ?? 0),
      };
    } catch (err: any) {
      return { ok: false as const, message: err?.message || "Could not validate promo code" };
    }
  });

export const createOrder = createFn({ method: "POST" })
  .inputValidator((input) => CreateOrderSchema.parse(input))
  .handler(async ({ data }) => {
    const res = await apiClient.post<{
      order_id: string;
      total: number;
      new_balance: number;
    }>("/api/orders", data);

    return {
      ok: true,
      order_id: res.order_id,
      total: res.total,
      new_balance: res.new_balance,
    };
  });

export const notifyCleaningRequest = createFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        items: z
          .array(
            z.object({
              name: z.string().min(1).max(200),
              quantity: z.number().int().min(1).max(200),
              line_total: z.number().nonnegative(),
            }),
          )
          .min(1)
          .max(60),
        service_type: z.enum(["cleaning", "pest_control"]).optional(),
        subtotal: z.number().nonnegative(),
        space_type: z.string().trim().max(80).optional(),
        recurring: z.string().trim().max(40).optional(),
        preferred_date: z.string().trim().max(40).optional(),
        preferred_time: z.string().trim().max(40).optional(),
        address: z.string().trim().max(300).optional(),
        notes: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/orders/cleaning", data);
    return { ok: true };
  });

export const listMyOrders = createFn({ method: "GET" }).handler(async () => {
  const orders = await apiClient.get<any[]>("/api/orders");
  return (orders ?? []).map(serializeOrder);
});

export const getOrder = createFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    try {
      const o = await apiClient.get<any>(`/api/orders/${data.id}`);
      if (!o) return null;
      return serializeOrder(o);
    } catch {
      return null;
    }
  });

export type OrderItemRow = {
  service_item_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};
export type OrderItemsJson = {
  items: OrderItemRow[];
  meta?: {
    preferred_date?: string | null;
    preferred_time?: string | null;
    space_type?: string | null;
    recurring?: string | null;
  };
};

function serializeOrder(o: Record<string, unknown>) {
  return {
    id: (o.id || o._id) as string,
    service_type: (o.service_type || "laundry") as "laundry" | "cleaning" | "pest_control",
    items_json: (o.items_json ?? { items: [] }) as OrderItemsJson,
    subtotal: Number(o.subtotal ?? 0),
    delivery_fee: Number(o.delivery_fee ?? 0),
    discount_amount: Number(o.discount_amount ?? 0),
    total_amount: Number(o.total_amount ?? 0),
    delivery_method: (o.delivery_method as string) ?? "dropoff",
    address: (o.address as string | null) ?? null,
    special_instructions: (o.special_instructions as string | null) ?? null,
    status: (o.status as string) ?? "received",
    rating: (o.rating as number | null) ?? null,
    created_at: (o.created_at as string) ?? new Date().toISOString(),
  };
}
