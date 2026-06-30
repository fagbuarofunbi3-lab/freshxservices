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

// Public — used by footer / "Contact us" links anywhere on the site.
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
