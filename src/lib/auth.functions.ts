import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import { getFreshXSession } from "@/lib/session.server";
import { verifyPinResetToken } from "@/lib/pin-reset.server";
import { verifyPasswordResetToken } from "@/lib/password-reset.server";

const PhoneSchema = z
  .string()
  .trim()
  .min(7, "Enter your WhatsApp number")
  .max(20)
  .transform((raw) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("234")) return `+${digits}`;
    if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
    return `+234${digits}`;
  })
  .refine((n) => /^\+234[0-9]\d{9}$/.test(n), {
    message: "Enter a valid Nigerian WhatsApp number (e.g. 0812 345 6789)",
  });

const NameSchema = z.string().trim().min(2).max(80);
const EmailSchema = z.string().trim().toLowerCase().email().max(200);
const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200);

export const signUp = createServerFn({ method: "POST" })
  .validator((input) =>
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
    const res = await apiClient.post<{ user: any; token: string }>("/api/auth/signup", {
      full_name: data.full_name,
      whatsapp_number: data.whatsapp_number,
      email: data.email,
      password: data.password,
      referral_code: data.referral_code,
    }, { skipAuth: true });

    const session = await getFreshXSession();
    await session.update({
      profileId: res.user.id,
      token: res.token,
      role: res.user.role,
    });
    return { ok: true };
  });

export const logIn = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        whatsapp_number: PhoneSchema,
        password: PasswordSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const res = await apiClient.post<{ user: any; token: string }>("/api/auth/login", {
      whatsapp_number: data.whatsapp_number,
      password: data.password,
    }, { skipAuth: true });

    const session = await getFreshXSession();
    await session.update({
      profileId: res.user.id,
      token: res.token,
      role: res.user.role,
    });
    return { ok: true, role: res.user.role as "customer" | "admin" };
  });

export const logOut = createServerFn({ method: "POST" }).handler(async () => {
  try {
    await apiClient.post("/api/auth/logout");
  } catch {
    // Ignore server error on logout
  }
  const session = await getFreshXSession();
  await session.clear();
  return { ok: true };
});

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getFreshXSession();
  const token = session.data?.token;
  if (!token) {
    if (session.data?.profileId) {
      await session.clear();
    }
    return null;
  }

  try {
    const user = await apiClient.get<any>("/api/auth/me", { token });
    return {
      id: user.id as string,
      full_name: user.full_name as string,
      whatsapp_number: user.whatsapp_number as string,
      email: (user.email ?? null) as string | null,
      wallet_balance: Number(user.wallet_balance ?? 0),
      role: user.role as "customer" | "admin",
      language_preference: (user.language_preference ?? "en") as "en" | "pidgin",
      has_transaction_pin: !!user.has_transaction_pin,
      referral_code: (user.referral_code ?? "") as string,
      referred_users_count: Number(user.referred_users_count ?? 0),
      referral_earnings: Number(user.referral_earnings ?? 0),
    };
  } catch {
    return null;
  }
});

const PinSchema = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits");

export const setTransactionPin = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        new_pin: PinSchema,
        current_pin: PinSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/auth/pin", {
      pin: data.new_pin,
      current_pin: data.current_pin,
    });
    return { ok: true };
  });

export const verifyTransactionPin = createServerFn({ method: "POST" })
  .validator((input) => z.object({ pin: PinSchema }).parse(input))
  .handler(async ({ data }) => {
    const res = await apiClient.post<{ ok: boolean }>("/api/auth/pin/verify", {
      pin: data.pin,
    });
    return { ok: res.ok };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .validator((input) =>
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
    await apiClient.post("/api/auth/profile", data);
    return { ok: true };
  });

export const resetPasswordWithEmail = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        whatsapp_number: PhoneSchema,
        email: EmailSchema,
        new_password: PasswordSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/auth/reset-password", {
      whatsapp_number: data.whatsapp_number,
      email: data.email,
      new_password: data.new_password,
    }, { skipAuth: true });
    return { ok: true };
  });

export const requestPasswordResetEmail = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        whatsapp_number: PhoneSchema,
        email: EmailSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      await apiClient.post("/api/auth/forgot-password", {
        email: data.email,
      }, { skipAuth: true });
    } catch {
      // Ignore if fallback
    }

    const { sendBuiltInRecoveryEmail, maskEmail } = await import("@/lib/auth-email-reset.server");
    try {
      await sendBuiltInRecoveryEmail({
        email: data.email,
        name: "Valued Customer",
        profileId: data.whatsapp_number,
        redirectTo: "https://freshxservices.com.ng/reset-password?source=auth",
        failureMessage: "Could not send the password reset email. Please try again in a few minutes.",
      });
    } catch {
      // Continue
    }

    const maskEmailLocal = (email: string) => {
      const [name, domain] = email.split("@");
      if (!domain || name.length <= 2) return email;
      return `${name[0]}***${name[name.length - 1]}@${domain}`;
    };

    return { ok: true, masked_email: maskEmail ? maskEmail(data.email) : maskEmailLocal(data.email) };
  });

export const resetPasswordWithVerifiedEmail = createServerFn({ method: "POST" })
  .validator((input) =>
    z.object({
      new_password: PasswordSchema,
      email: EmailSchema.optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/auth/reset-password", {
      email: data.email,
      new_password: data.new_password,
    }, { skipAuth: true });
    return { ok: true };
  });

export const resetPasswordWithToken = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        token: z.string().min(10).max(1000),
        new_password: PasswordSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const decoded = verifyPasswordResetToken(data.token);
    if (!decoded) throw new Error("This reset link is invalid or has expired. Request a new one.");

    await apiClient.post("/api/auth/reset-password", {
      profile_id: decoded.profileId,
      new_password: data.new_password,
    }, { skipAuth: true });
    return { ok: true };
  });

export const requestTransactionPinReset = createServerFn({ method: "POST" }).handler(
  async () => {
    const me = await apiClient.get<any>("/api/auth/me");
    if (!me || !me.email) {
      throw new Error(
        "No email is set on your account. Add one in Settings → Profile first, then try again.",
      );
    }

    const { sendBuiltInRecoveryEmail, maskEmail } = await import("@/lib/auth-email-reset.server");
    await sendBuiltInRecoveryEmail({
      email: me.email,
      name: me.full_name ?? "",
      profileId: me.id,
      redirectTo: "https://freshxservices.com.ng/reset-pin?source=auth",
      failureMessage: "Could not send the reset email. Please try again in a few minutes.",
    });

    const maskEmailLocal = (email: string) => {
      const [name, domain] = email.split("@");
      if (!domain || name.length <= 2) return email;
      return `${name[0]}***${name[name.length - 1]}@${domain}`;
    };

    return { ok: true, masked_email: maskEmail ? maskEmail(me.email) : maskEmailLocal(me.email) };
  },
);

export const resetTransactionPinWithVerifiedEmail = createServerFn({ method: "POST" })
  .validator((input) => z.object({ new_pin: PinSchema }).parse(input))
  .handler(async ({ data }) => {
    await apiClient.post("/api/auth/pin", {
      pin: data.new_pin,
    });
    return { ok: true };
  });

export const resetTransactionPinWithToken = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        token: z.string().min(10).max(1000),
        new_pin: PinSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const decoded = verifyPinResetToken(data.token);
    if (!decoded) throw new Error("This reset link is invalid or has expired. Request a new one.");

    await apiClient.post("/api/auth/pin", {
      pin: data.new_pin,
    });
    return { ok: true };
  });
