import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFreshXSession } from "@/lib/session.server";

async function requireProfileId(): Promise<string> {
  const session = await getFreshXSession();
  const id = session.data?.profileId;
  if (!id) throw new Error("Not signed in");
  return id;
}

export const listServiceItems = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("service_items")
    .select("id, category, name, price, is_active")
    .eq("is_active", true)
    .order("category")
    .order("price");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    category: r.category as string,
    name: r.name as string,
    price: Number(r.price),
  }));
});

const OrderItemSchema = z.object({
  service_item_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  unit_price: z.number().nonnegative(),
  quantity: z.number().int().min(1).max(200),
});

const CreateOrderSchema = z.object({
  service_type: z.enum(["laundry", "cleaning"]),
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

export const applyPromo = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ code: z.string().trim().min(1).max(40), subtotal: z.number().min(0) }).parse(input),
  )
  .handler(async ({ data }) => {
    const code = data.code.toUpperCase();
    const { data: promo } = await supabaseAdmin
      .from("promo_codes")
      .select("id, code, type, value, min_order_amount, expiry_date, usage_limit, times_used, is_active")
      .eq("code", code)
      .maybeSingle();
    if (!promo || !promo.is_active) return { ok: false as const, message: "Invalid promo code" };
    if (promo.expiry_date && new Date(promo.expiry_date as string) < new Date())
      return { ok: false as const, message: "This promo has expired" };
    if (promo.usage_limit != null && (promo.times_used as number) >= (promo.usage_limit as number))
      return { ok: false as const, message: "This promo has reached its usage limit" };
    if (data.subtotal < Number(promo.min_order_amount))
      return {
        ok: false as const,
        message: `Minimum order of ₦${Number(promo.min_order_amount).toLocaleString()} required`,
      };

    const discount =
      promo.type === "percentage"
        ? Math.round((data.subtotal * Number(promo.value)) / 100)
        : Math.min(Number(promo.value), data.subtotal);
    return {
      ok: true as const,
      promo_id: promo.id as string,
      code: promo.code as string,
      discount,
    };
  });

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => CreateOrderSchema.parse(input))
  .handler(async ({ data }) => {
    const profileId = await requireProfileId();

    if (data.service_type !== "laundry") {
      throw new Error("Only laundry orders are paid through the wallet. Cleaning is booked via WhatsApp.");
    }

    // Verify transaction PIN
    const { data: pinProfile } = await supabaseAdmin
      .from("profiles")
      .select("transaction_pin_hash")
      .eq("id", profileId)
      .single();
    const pinHash = (pinProfile as { transaction_pin_hash?: string | null } | null)?.transaction_pin_hash;
    if (!pinHash) throw new Error("Set up your 4-digit transaction PIN before paying.");
    const { data: pinOk, error: pinErr } = await supabaseAdmin.rpc("verify_password" as never, {
      plain: data.transaction_pin,
      hash: pinHash,
    } as never);
    if (pinErr) throw new Error(pinErr.message);
    if (pinOk !== true) throw new Error("Incorrect transaction PIN");

    // Re-price server-side against the live catalog
    const ids = data.items.map((i) => i.service_item_id);
    const { data: catalog, error: catErr } = await supabaseAdmin
      .from("service_items")
      .select("id, name, price")
      .in("id", ids);
    if (catErr) throw new Error(catErr.message);
    const priceMap = new Map(
      (catalog ?? []).map((r) => [r.id as string, { name: r.name as string, price: Number(r.price) }]),
    );

    let subtotal = 0;
    const items = data.items.map((it) => {
      const ref = priceMap.get(it.service_item_id);
      if (!ref) throw new Error("Service item no longer available");
      const line = ref.price * it.quantity;
      subtotal += line;
      return {
        service_item_id: it.service_item_id,
        name: ref.name,
        unit_price: ref.price,
        quantity: it.quantity,
        line_total: line,
      };
    });

    const deliveryFee = data.delivery_method === "pickup" ? data.delivery_fee : 0;

    // Promo
    let discount = 0;
    let promoId: string | null = null;
    let promoCodeStr: string | null = null;
    let promoOwnerId: string | null = null;
    if (data.promo_code) {
      const code = data.promo_code.toUpperCase();
      const { data: promo } = await supabaseAdmin
        .from("promo_codes")
        .select("id, code, type, value, min_order_amount, expiry_date, usage_limit, times_used, is_active, owner_profile_id")
        .eq("code", code)
        .maybeSingle();
      if (
        promo &&
        promo.is_active &&
        (!promo.expiry_date || new Date(promo.expiry_date as string) >= new Date()) &&
        (promo.usage_limit == null || (promo.times_used as number) < (promo.usage_limit as number)) &&
        subtotal >= Number(promo.min_order_amount) &&
        (promo.owner_profile_id as string | null) !== profileId
      ) {
        discount =
          promo.type === "percentage"
            ? Math.round((subtotal * Number(promo.value)) / 100)
            : Math.min(Number(promo.value), subtotal);
        promoId = promo.id as string;
        promoCodeStr = promo.code as string;
        promoOwnerId = (promo.owner_profile_id as string | null) ?? null;
      }
    }

    const total = Math.max(0, subtotal + deliveryFee - discount);

    // Wallet check
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("wallet_balance, full_name")
      .eq("id", profileId)
      .single();
    const balance = Number(profile?.wallet_balance ?? 0);
    if (balance < total) {
      throw new Error(`Insufficient wallet balance. You need ₦${(total - balance).toLocaleString()} more.`);
    }

    const meta = {
      preferred_date: data.preferred_date ?? null,
      preferred_time: data.preferred_time ?? null,
      space_type: data.space_type ?? null,
      recurring: data.recurring ?? null,
    };

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        profile_id: profileId,
        service_type: data.service_type,
        items_json: { items, meta },
        subtotal,
        delivery_fee: deliveryFee,
        discount_amount: discount,
        total_amount: total,
        promo_code_id: promoId,
        delivery_method: data.delivery_method,
        address: data.address ?? null,
        special_instructions: data.special_instructions ?? null,
        status: "received",
      })
      .select("id")
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message ?? "Could not create order");

    // Debit wallet + log transaction
    const newBalance = balance - total;
    await supabaseAdmin.from("profiles").update({ wallet_balance: newBalance }).eq("id", profileId);
    await supabaseAdmin.from("wallet_transactions").insert({
      profile_id: profileId,
      type: "debit",
      amount: total,
      description: `${data.service_type === "laundry" ? "Laundry" : "Cleaning"} order`,
      order_id: order.id,
    });
    if (promoId) {
      await supabaseAdmin.rpc as never; // (no-op; increment below)
      await supabaseAdmin
        .from("promo_codes")
        .update({ times_used: (await getPromoUses(promoId)) + 1 })
        .eq("id", promoId);
    }

    // Queue notifications (in-app + WhatsApp-pending)
    await supabaseAdmin.from("notifications").insert([
      {
        profile_id: profileId,
        message: `Order received — ₦${total.toLocaleString()} deducted. New balance: ₦${newBalance.toLocaleString()}.`,
        channel: "in_app",
        type: "order_created",
      },
      {
        profile_id: profileId,
        message: buildAdminWhatsApp({
          customer: profile?.full_name ?? "Customer",
          orderId: order.id as string,
          serviceType: data.service_type,
          items,
          delivery: data.delivery_method,
          promo: data.promo_code,
          discount,
          total,
          newBalance,
        }),
        channel: "whatsapp_pending",
        type: "order_admin",
      },
    ]);

    // Low balance reminder
    if (newBalance < 500) {
      await supabaseAdmin.from("notifications").insert({
        profile_id: profileId,
        message: "Your wallet is low. Top up to keep placing orders.",
        channel: "in_app",
        type: "low_balance",
      });
    }

    // Owner notification email (Resend)
    try {
      const { sendOrderEmailToOwner } = await import("@/lib/email.server");
      await sendOrderEmailToOwner({
        serviceType: "laundry",
        orderRef: `FX-${(order.id as string).slice(0, 8).toUpperCase()}`,
        customerName: profile?.full_name ?? "Customer",
        customerWhatsapp: "—",
        items,
        subtotal,
        deliveryFee,
        discount,
        total,
        delivery: data.delivery_method,
        address: data.address ?? null,
        notes: data.special_instructions ?? null,
      });
    } catch (err) {
      console.error("[orders] owner email failed:", err);
    }

    return { ok: true, order_id: order.id as string, total, new_balance: newBalance };
  });

// Cleaning service: no wallet charge, but owner still gets an email when the
// user clicks "Proceed to WhatsApp admin" from the order builder.
export const notifyCleaningRequest = createServerFn({ method: "POST" })
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
    const profileId = await requireProfileId();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, whatsapp_number")
      .eq("id", profileId)
      .single();
    try {
      const { sendOrderEmailToOwner } = await import("@/lib/email.server");
      await sendOrderEmailToOwner({
        serviceType: "cleaning",
        orderRef: `CL-${Date.now().toString(36).toUpperCase()}`,
        customerName: profile?.full_name ?? "Customer",
        customerWhatsapp: profile?.whatsapp_number ?? "—",
        items: data.items,
        subtotal: data.subtotal,
        total: data.subtotal,
        spaceType: data.space_type ?? null,
        recurring: data.recurring ?? null,
        preferredDate: data.preferred_date ?? null,
        preferredTime: data.preferred_time ?? null,
        address: data.address ?? null,
        notes: data.notes ?? null,
        pricingNote:
          "Estimated price from website. Final cost may vary based on location, room size, or other factors.",
      });
    } catch (err) {
      console.error("[orders] cleaning email failed:", err);
    }
    return { ok: true };
  });


async function getPromoUses(promoId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("promo_codes")
    .select("times_used")
    .eq("id", promoId)
    .single();
  return Number(data?.times_used ?? 0);
}

function buildAdminWhatsApp(p: {
  customer: string;
  orderId: string;
  serviceType: string;
  items: Array<{ name: string; quantity: number; line_total: number }>;
  delivery: string;
  promo?: string;
  discount: number;
  total: number;
  newBalance: number;
}): string {
  const lines = [
    `🧺 *New FreshX Order*`,
    ``,
    `Customer: ${p.customer}`,
    `Order ID: FX-${p.orderId.slice(0, 8).toUpperCase()}`,
    `Service: ${p.serviceType === "laundry" ? "Laundry" : "Cleaning"}`,
    ``,
    `Items:`,
    ...p.items.map((i) => `- ${i.name} × ${i.quantity} = ₦${i.line_total.toLocaleString()}`),
    ``,
    `Delivery: ${p.delivery === "pickup" ? "Pickup" : "Drop-off"}`,
  ];
  if (p.promo && p.discount > 0) lines.push(`Promo: ${p.promo} (−₦${p.discount.toLocaleString()})`);
  lines.push(`*Total: ₦${p.total.toLocaleString()}*`);
  lines.push(`Wallet balance after deduction: ₦${p.newBalance.toLocaleString()}`);
  return lines.join("\n");
}

export const listMyOrders = createServerFn({ method: "GET" }).handler(async () => {
  const profileId = await requireProfileId();
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, service_type, items_json, subtotal, delivery_fee, discount_amount, total_amount, delivery_method, status, rating, created_at",
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map(serializeOrder);
});

export const getOrder = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const profileId = await requireProfileId();
    const { data: o, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", data.id)
      .eq("profile_id", profileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!o) return null;
    return serializeOrder(o);
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
    id: o.id as string,
    service_type: o.service_type as "laundry" | "cleaning",
    items_json: (o.items_json ?? { items: [] }) as OrderItemsJson,
    subtotal: Number(o.subtotal ?? 0),
    delivery_fee: Number(o.delivery_fee ?? 0),
    discount_amount: Number(o.discount_amount ?? 0),
    total_amount: Number(o.total_amount ?? 0),
    delivery_method: (o.delivery_method as string) ?? "dropoff",
    address: (o.address as string | null) ?? null,
    special_instructions: (o.special_instructions as string | null) ?? null,
    status: o.status as string,
    rating: (o.rating as number | null) ?? null,
    created_at: o.created_at as string,
  };
}
