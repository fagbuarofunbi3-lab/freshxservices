import { z } from "zod";
import { apiClient, saveAuthSession, clearAuthSession, getAuthToken } from "@/lib/api-client";
import { createFn } from "@/lib/create-fn";

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

export const signUp = createFn({ method: "POST" })
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

    saveAuthSession(res.user, res.token);
    return { ok: true };
  });

export const logIn = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        email: EmailSchema,
        password: PasswordSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const res = await apiClient.post<{ ok: boolean; user: any; token: string; role?: string }>("/api/auth/login", {
      email: data.email,
      password: data.password,
    }, { skipAuth: true });

    saveAuthSession(res.user, res.token);
    const role = (res.role ?? res.user?.role ?? "customer") as "customer" | "admin";
    return { ok: true, role };
  });

export const logOut = createFn({ method: "POST" }).handler(async () => {
  try {
    await apiClient.post("/api/auth/logout");
  } catch {
    // Ignore server error on logout
  }
  clearAuthSession();
  return { ok: true };
});

export type UserRole = "customer" | "admin" | "operations" | "finance" | "support";

export function isAdminRole(role?: string): boolean {
  return role === "admin" || role === "operations" || role === "finance" || role === "support";
}

export function canManageAdmins(role?: string): boolean {
  return role === "admin";
}

export function canManageSettings(role?: string): boolean {
  return role === "admin";
}

export function canManageFinances(role?: string): boolean {
  return role === "admin" || role === "finance";
}

export function canManageOrders(role?: string): boolean {
  return role === "admin" || role === "operations" || role === "support";
}

export function canManageServices(role?: string): boolean {
  return role === "admin" || role === "operations";
}

export function canManageProfessionals(role?: string): boolean {
  return role === "admin" || role === "operations";
}

export function getRoleBadge(role?: string): { label: string; color: string } {
  switch (role) {
    case "admin":
      return { label: "Super Admin", color: "bg-red-500/15 text-red-500 border-red-500/30" };
    case "operations":
      return { label: "Operations Admin", color: "bg-blue-500/15 text-blue-500 border-blue-500/30" };
    case "finance":
      return { label: "Finance Admin", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" };
    case "support":
      return { label: "Support Admin", color: "bg-amber-500/15 text-amber-500 border-amber-500/30" };
    default:
      return { label: "Customer", color: "bg-muted text-muted-foreground border-border" };
  }
}

export const getMe = createFn({ method: "GET" }).handler(async () => {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const user = await apiClient.get<any>("/api/auth/me", { token });
    return {
      id: user.id as string,
      full_name: user.full_name as string,
      whatsapp_number: user.whatsapp_number as string,
      email: (user.email ?? null) as string | null,
      wallet_balance: Number(user.wallet_balance ?? 0),
      role: (user.role ?? "customer") as UserRole,
      language_preference: (user.language_preference ?? "en") as "en" | "pidgin",
      has_transaction_pin: !!user.has_transaction_pin,
      referral_code: (user.referral_code ?? "") as string,
      referred_users_count: Number(user.referred_users_count ?? 0),
      referral_earnings: Number(user.referral_earnings ?? 0),
    };
  } catch {
    clearAuthSession();
    return null;
  }
});

const PinSchema = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits");

export const setTransactionPin = createFn({ method: "POST" })
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

export const verifyTransactionPin = createFn({ method: "POST" })
  .validator((input) => z.object({ pin: PinSchema }).parse(input))
  .handler(async ({ data }) => {
    const res = await apiClient.post<{ ok: boolean }>("/api/auth/pin/verify", {
      pin: data.pin,
    });
    return { ok: res.ok };
  });

export const updateProfile = createFn({ method: "POST" })
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

export const resetPasswordWithEmail = createFn({ method: "POST" })
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

export const requestPasswordResetEmail = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        email: EmailSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/auth/forgot-password", {
      email: data.email,
    }, { skipAuth: true });

    const maskEmailLocal = (email: string) => {
      const [name, domain] = email.split("@");
      if (!domain || name.length <= 2) return email;
      return `${name[0]}***${name[name.length - 1]}@${domain}`;
    };

    return { ok: true, masked_email: maskEmailLocal(data.email) };
  });

export const resetPasswordWithVerifiedEmail = createFn({ method: "POST" })
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

export const verifyEmailOTP = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        email: EmailSchema,
        code: z.string().min(4).max(10),
        purpose: z.string().optional().default("reset_password"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const res = await apiClient.post<{ ok: boolean; valid: boolean }>(
      "/api/auth/verify-otp",
      {
        email: data.email,
        code: data.code.trim(),
        purpose: data.purpose || "reset_password",
      },
      { skipAuth: true },
    );
    return res;
  });

export const resetPasswordWithOTP = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        email: EmailSchema,
        otp: z.string().min(4).max(10),
        new_password: PasswordSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/auth/reset-password", {
      email: data.email,
      otp: data.otp.trim(),
      new_password: data.new_password,
    }, { skipAuth: true });
    return { ok: true };
  });

export const resetPasswordWithToken = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        email: EmailSchema.optional(),
        token: z.string().min(1).max(1000),
        new_password: PasswordSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/auth/reset-password", {
      email: data.email,
      otp: data.token,
      new_password: data.new_password,
    }, { skipAuth: true });
    return { ok: true };
  });

export const requestTransactionPinReset = createFn({ method: "POST" }).handler(
  async () => {
    const me = await apiClient.get<any>("/api/auth/me");
    if (!me || !me.email) {
      throw new Error(
        "No email is set on your account. Add one in Settings → Profile first, then try again.",
      );
    }

    await apiClient.post("/api/auth/forgot-password", {
      email: me.email,
    }, { skipAuth: true });

    const maskEmailLocal = (email: string) => {
      const [name, domain] = email.split("@");
      if (!domain || name.length <= 2) return email;
      return `${name[0]}***${name[name.length - 1]}@${domain}`;
    };

    return { ok: true, masked_email: maskEmailLocal(me.email) };
  },
);

export const resetTransactionPinWithVerifiedEmail = createFn({ method: "POST" })
  .validator((input) => z.object({ new_pin: PinSchema }).parse(input))
  .handler(async ({ data }) => {
    await apiClient.post("/api/auth/pin", {
      pin: data.new_pin,
    });
    return { ok: true };
  });

export const resetTransactionPinWithToken = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        token: z.string().min(1).max(1000),
        new_pin: PinSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/auth/pin", {
      pin: data.new_pin,
    });
    return { ok: true };
  });

export const googleAuth = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        id_token: z.string().min(1),
        whatsapp_number: z.string().optional(),
        referral_code: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const res = await apiClient.post<{
      user?: any;
      token?: string;
      needs_phone: boolean;
      is_new: boolean;
      email?: string;
      full_name?: string;
    }>("/api/auth/google", data, { skipAuth: true });

    if (res.token && res.user) {
      saveAuthSession(res.user, res.token);
    }
    return res;
  });

export const sendSecurityOTP = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        email: EmailSchema.optional(),
        purpose: z.enum([
          "change_password",
          "create_pin",
          "delete_pin",
          "reset_password",
          "signup",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/auth/send-otp", {
      email: data.email,
      purpose: data.purpose,
    });
    return { ok: true };
  });

export const changePasswordWithOTP = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        new_password: PasswordSchema,
        otp: z.string().min(4).max(10),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/auth/change-password", {
      new_password: data.new_password,
      otp: data.otp.trim(),
    });
    return { ok: true };
  });

export const setTransactionPinWithOTP = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        new_pin: PinSchema,
        otp: z.string().min(4).max(10),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/auth/pin", {
      new_pin: data.new_pin,
      pin: data.new_pin,
      otp: data.otp.trim(),
    });
    return { ok: true };
  });

export const deleteTransactionPinWithOTP = createFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        otp: z.string().min(4).max(10),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await apiClient.post("/api/auth/pin/delete", {
      otp: data.otp.trim(),
    });
    return { ok: true };
  });



