import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@/lib/create-fn";
import { useState } from "react";
import { toast } from "sonner";
import { resetPasswordWithOTP } from "@/lib/auth.functions";
import { AuthShell, Field, PasswordInput } from "@/components/AuthShell";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): { email?: string; otp?: string; code?: string; token?: string } => ({
    email: typeof search.email === "string" ? search.email : undefined,
    otp: typeof search.otp === "string" ? search.otp : typeof search.code === "string" ? search.code : typeof search.token === "string" ? search.token : undefined,
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { email = "", otp = "" } = Route.useSearch();
  const resetFn = useServerFn(resetPasswordWithOTP);
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !otp) {
      toast.error("Missing verification code. Please request a new code.");
      navigate({ to: "/forgot-password" });
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await resetFn({
        data: {
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          new_password: password,
        },
      });
      toast.success("Password reset successfully! You can now log in.");
      await navigate({ to: "/login", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  if (!email || !otp) {
    return (
      <AuthShell title="Reset password" subtitle="Verification required">
        <p className="text-center text-sm text-muted-foreground">
          To reset your password, please start by requesting a verification code.
        </p>
        <div className="mt-6 text-center">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Request verification code
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create new password"
      subtitle="Enter and confirm your new password below."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="New password">
          <PasswordInput
            value={password}
            onChange={setPassword}
            show={showPw}
            onToggle={() => setShowPw((s) => !s)}
          />
        </Field>

        <Field label="Confirm new password">
          <PasswordInput
            value={confirm}
            onChange={setConfirm}
            show={showPw}
            onToggle={() => setShowPw((s) => !s)}
          />
        </Field>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Saving new password…" : "Save new password"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered your password?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthShell>
  );
}