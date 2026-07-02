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
const EmailSchema = z.string().trim().toLowerCase().email().max(200);
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
        email: EmailSchema,
        password: PasswordSchema,
        referral_code: z
          .string()
          .trim()
          .max(40)
          .optional()
          .transform((v) => (v ? v.toUpperCase() : undefined)),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const existingPhone = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("whatsapp_number", data.whatsapp_number)
      .maybeSingle();
    if (existingPhone.data) {
      throw new Error("An account with this WhatsApp number already exists. Try logging in.");
    }
    const existingEmail = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    if (existingEmail.data) {
      throw new Error("An account with this email already exists.");
    }

    // Validate referral code (if provided) but never block signup on it
    let referredByCode: string | null = null;
    let referralRowId: string | null = null;
    if (data.referral_code) {
      const { data: ref } = await supabaseAdmin
        .from("referral_codes")
        .select("id, code, is_active")
        .ilike("code", data.referral_code)
        .maybeSingle();
      if (ref && ref.is_active) {
        referredByCode = ref.code as string;
        referralRowId = ref.id as string;
      }
    }

    const password_hash = await hashPassword(data.password);
    const { data: created, error } = await supabaseAdmin
      .from("profiles")
      .insert({
        full_name: data.full_name,
        whatsapp_number: data.whatsapp_number,
        email: data.email,
        password_hash,
        referred_by_code: referredByCode,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not create account");

    if (referralRowId) {
      await supabaseAdmin.rpc("increment_referral_use" as never, { _id: referralRowId } as never).then(
        () => undefined,
        async () => {
          // Fallback if RPC doesn't exist yet — do a manual increment
          const { data: cur } = await supabaseAdmin
            .from("referral_codes")
            .select("times_used")
            .eq("id", referralRowId!)
            .maybeSingle();
          await supabaseAdmin
            .from("referral_codes")
            .update({ times_used: Number(cur?.times_used ?? 0) + 1 })
            .eq("id", referralRowId!);
        },
      );
    }

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
      .select("id, password_hash, role")
      .eq("whatsapp_number", data.whatsapp_number)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Invalid WhatsApp number or password");

    const ok = await verifyPassword(data.password, profile.password_hash);
    if (!ok) throw new Error("Invalid WhatsApp number or password");

    const session = await getFreshXSession();
    await session.update({ profileId: profile.id });
    return { ok: true, role: profile.role as "customer" | "admin" };
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
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, whatsapp_number, email, wallet_balance, role, language_preference, transaction_pin_hash")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) return null;
  return {
    id: profile.id as string,
    full_name: profile.full_name as string,
    whatsapp_number: profile.whatsapp_number as string,
    email: ((profile as { email?: string | null }).email ?? null) as string | null,
    wallet_balance: Number(profile.wallet_balance ?? 0),
    role: profile.role as "customer" | "admin",
    language_preference: profile.language_preference as "en" | "pidgin",
    has_transaction_pin: !!(profile as { transaction_pin_hash?: string | null }).transaction_pin_hash,
  };
});

const PinSchema = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits");

export const setTransactionPin = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        new_pin: PinSchema,
        current_pin: PinSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await getFreshXSession();
    const profileId = session.data?.profileId;
    if (!profileId) throw new Error("Not signed in");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("transaction_pin_hash")
      .eq("id", profileId)
      .single();
    const existingHash = (profile as { transaction_pin_hash?: string | null } | null)?.transaction_pin_hash ?? null;

    if (existingHash) {
      if (!data.current_pin) throw new Error("Enter your current PIN to change it");
      const ok = await verifyPassword(data.current_pin, existingHash);
      if (!ok) throw new Error("Current PIN is incorrect");
    }

    const hash = await hashPassword(data.new_pin);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ transaction_pin_hash: hash })
      .eq("id", profileId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const verifyTransactionPin = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ pin: PinSchema }).parse(input))
  .handler(async ({ data }) => {
    const session = await getFreshXSession();
    const profileId = session.data?.profileId;
    if (!profileId) throw new Error("Not signed in");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("transaction_pin_hash")
      .eq("id", profileId)
      .single();
    const hash = (profile as { transaction_pin_hash?: string | null } | null)?.transaction_pin_hash;
    if (!hash) throw new Error("No transaction PIN set");
    const ok = await verifyPassword(data.pin, hash);
    return { ok };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        full_name: NameSchema.optional(),
        whatsapp_number: PhoneSchema.optional(),
        email: EmailSchema.optional(),
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
    if (data.email) {
      const dupe = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", data.email)
        .neq("id", profileId)
        .maybeSingle();
      if (dupe.data) throw new Error("That email is already in use.");
    }

    const patch: {
      full_name?: string;
      whatsapp_number?: string;
      email?: string;
      language_preference?: "en" | "pidgin";
      password_hash?: string;
    } = {};
    if (data.full_name) patch.full_name = data.full_name;
    if (data.whatsapp_number) patch.whatsapp_number = data.whatsapp_number;
    if (data.email) patch.email = data.email;
    if (data.language_preference) patch.language_preference = data.language_preference;
    if (data.new_password) patch.password_hash = await hashPassword(data.new_password);
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", profileId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Password recovery: verify ownership using WhatsApp number + email pair, then set a new password.
// This is a basic recovery for MVP — no email send. Both must match the same account.
export const resetPasswordWithEmail = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        whatsapp_number: PhoneSchema,
        email: EmailSchema,
        new_password: PasswordSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("whatsapp_number", data.whatsapp_number)
      .maybeSingle();
    const profileEmail = (profile as { email?: string | null } | null)?.email ?? null;
    if (!profile || !profileEmail || profileEmail.toLowerCase() !== data.email) {
      // Generic failure to avoid leaking which field is wrong
      throw new Error("No matching account found for that WhatsApp number and email.");
    }
    const password_hash = await hashPassword(data.new_password);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ password_hash })
      .eq("id", profile.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
