import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function isAlreadyRegisteredError(error: unknown): boolean {
  const err = error as { message?: string; code?: string; status?: number };
  const code = String(err.code ?? "").toLowerCase();
  const message = String(err.message ?? "").toLowerCase();
  return (
    code.includes("already") ||
    code.includes("exists") ||
    message.includes("already") ||
    message.includes("registered") ||
    message.includes("exists")
  );
}

export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  const maskedUser =
    user.length <= 2 ? `${user.slice(0, 1)}*` : `${user.slice(0, 2)}${"*".repeat(Math.max(1, user.length - 2))}`;
  return domain ? `${maskedUser}@${domain}` : maskedUser;
}

export async function sendBuiltInRecoveryEmail(params: {
  email: string;
  name?: string | null;
  profileId: string;
  redirectTo: string;
  failureMessage: string;
}): Promise<void> {
  const password = `${randomBytes(36).toString("base64url")}Aa1!`;

  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: params.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: params.name ?? "",
      freshx_profile_id: params.profileId,
    },
  });

  if (createError && !isAlreadyRegisteredError(createError)) {
    console.error("[auth-email] could not prepare built-in reset user:", createError.message);
    throw new Error(params.failureMessage);
  }

  const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(params.email, {
    redirectTo: params.redirectTo,
  });

  if (resetError) {
    console.error("[auth-email] built-in reset email failed:", resetError.message);
    throw new Error(params.failureMessage);
  }
}