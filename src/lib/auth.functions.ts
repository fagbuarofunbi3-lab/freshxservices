import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFreshXSession } from "@/lib/session.server";

const PhoneSchema = z
  .string()
  .trim()
  .min(10)
  .max(20)
  .transform((raw) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("234")) return `+${digits}`;
    if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
    return `+234${digits}`;
  })
  .refine((n) => /^\+234[789]\d{9}$/.test(n), {
    message: "Enter a valid Nigerian WhatsApp number",
  });

const NameSchema = z.string().trim().min(2).max(80);
const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200);

async function hashPassword(plain: string): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("crypt_password" as never, {
    plain,
  } as never);
  if (error) throw new Error(error.message);
  if (typeof data !== "string") throw new Error("Failed to hash password");
  return data;
}

async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("verify_password" as never, {
    plain,
    hash,
  } as never);
  if (error) throw new Error(error.message);
  return data === true;
}

export const signUp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        full_name: NameSchema,
        whatsapp_number: PhoneSchema,
        password: PasswordSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const existing = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("whatsapp_number", data.whatsapp_number)
      .maybeSingle();
    if (existing.data) {
      throw new Error("An account with this WhatsApp number already exists. Try logging in.");
    }
    const password_hash = await hashPassword(data.password);
    const { data: created, error } = await supabaseAdmin
      .from("profiles")
      .insert({
        full_name: data.full_name,
        whatsapp_number: data.whatsapp_number,
        password_hash,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not create account");

    const session = await getFreshXSession();
    await session.update({ profileId: created.id });
    return { ok: true };
  });

export const logIn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        whatsapp_number: PhoneSchema,
        password: PasswordSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, password_hash")
      .eq("whatsapp_number", data.whatsapp_number)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Invalid WhatsApp number or password");

    const ok = await verifyPassword(data.password, profile.password_hash);
    if (!ok) throw new Error("Invalid WhatsApp number or password");

    const session = await getFreshXSession();
    await session.update({ profileId: profile.id });
    return { ok: true };
  });

export const logOut = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getFreshXSession();
  await session.clear();
  return { ok: true };
});

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getFreshXSession();
  const profileId = session.data?.profileId;
  if (!profileId) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, whatsapp_number, wallet_balance, role, language_preference")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile) {
    await session.clear();
    return null;
  }
  return {
    id: profile.id as string,
    full_name: profile.full_name as string,
    whatsapp_number: profile.whatsapp_number as string,
    wallet_balance: Number(profile.wallet_balance ?? 0),
    role: profile.role as "customer" | "admin",
    language_preference: profile.language_preference as "en" | "pidgin",
  };
});

export const updateProfile = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        full_name: NameSchema.optional(),
        whatsapp_number: PhoneSchema.optional(),
        language_preference: z.enum(["en", "pidgin"]).optional(),
        new_password: PasswordSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await getFreshXSession();
    const profileId = session.data?.profileId;
    if (!profileId) throw new Error("Not signed in");

    if (data.whatsapp_number) {
      const dupe = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("whatsapp_number", data.whatsapp_number)
        .neq("id", profileId)
        .maybeSingle();
      if (dupe.data) throw new Error("That WhatsApp number is already in use.");
    }

    const patch: {
      full_name?: string;
      whatsapp_number?: string;
      language_preference?: "en" | "pidgin";
      password_hash?: string;
    } = {};
    if (data.full_name) patch.full_name = data.full_name;
    if (data.whatsapp_number) patch.whatsapp_number = data.whatsapp_number;
    if (data.language_preference) patch.language_preference = data.language_preference;
    if (data.new_password) patch.password_hash = await hashPassword(data.new_password);
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", profileId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
