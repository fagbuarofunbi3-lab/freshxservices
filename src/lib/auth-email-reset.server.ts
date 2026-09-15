import { apiClient } from "@/lib/api-client";

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
  try {
    await apiClient.post("/api/auth/forgot-password", {
      email: params.email,
    }, { skipAuth: true });
  } catch (err) {
    console.error("[auth-email] built-in reset email failed:", err);
    throw new Error(params.failureMessage);
  }
}