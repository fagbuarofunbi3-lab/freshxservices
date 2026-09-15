import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@/lib/create-fn";
import { useState } from "react";
import { toast } from "sonner";
import { resetPasswordWithOTP } from "@/lib/auth.functions";
import { AuthShell, Field, PasswordInput } from "./signup";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
    code: typeof search.code === "string" ? search.code : "",
    email: typeof search.email === "string" ? search.email : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const search = Route.useSearch();
  const resetFn = useServerFn(resetPasswordWithOTP);
  const navigate = useNavigate();

  const [email, setEmail] = useState(search.email || "");
  const [otp, setOtp] = useState(search.code || search.token || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!cleanEmail) return toast.error("Please enter your email address");
    if (!cleanOtp || cleanOtp.length < 4) return toast.error("Please enter the 6-digit verification code");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");

    setLoading(true);
    try {
      await resetFn({
        data: {
          email: cleanEmail,
          otp: cleanOtp,
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

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Enter the 6-digit code sent to your email to set a new password."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {!search.email && (
          <Field label="Email address">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="you@example.com"
            />
          </Field>
        )}

        <Field label="6-digit verification code">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-center font-mono text-xl font-bold tracking-[0.4em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="••••••"
          />
        </Field>

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
          {loading ? "Saving…" : "Save new password"}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <Link to="/forgot-password" className="font-medium text-primary hover:underline">
          Didn't get a code? Request one here
        </Link>
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </div>
    </AuthShell>
  );
}