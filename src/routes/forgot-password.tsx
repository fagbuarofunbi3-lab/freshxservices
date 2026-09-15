import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@/lib/create-fn";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { requestPasswordResetEmail, resetPasswordWithOTP } from "@/lib/auth.functions";
import { AuthShell, Field, PasswordInput } from "./signup";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const sendEmailFn = useServerFn(requestPasswordResetEmail);
  const resetFn = useServerFn(resetPasswordWithOTP);
  const navigate = useNavigate();

  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown countdown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Step 1: Send OTP to email
  async function onRequestCode(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Please enter your email address");
      return;
    }

    setLoading(true);
    try {
      const res = await sendEmailFn({ data: { email: cleanEmail } });
      setMaskedEmail(res.masked_email || cleanEmail);
      setStep("reset");
      setCooldown(60);
      toast.success("Verification code sent to your email!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset code");
    } finally {
      setLoading(false);
    }
  }

  // Resend code action
  async function onResend() {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    try {
      await sendEmailFn({ data: { email: email.trim().toLowerCase() } });
      setCooldown(60);
      toast.success("A new code has been sent to your email.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify OTP and set new password
  async function onResetPassword(e: React.FormEvent) {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      toast.error("Please enter the 6-digit code sent to your email");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await resetFn({
        data: {
          email: email.trim().toLowerCase(),
          otp: cleanOtp,
          new_password: newPassword,
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

  if (step === "reset") {
    return (
      <AuthShell
        title="Enter verification code"
        subtitle={`We sent a 6-digit code to ${maskedEmail}`}
      >
        <form onSubmit={onResetPassword} className="space-y-4">
          <Field label="6-digit verification code">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              autoFocus
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-center font-mono text-2xl font-bold tracking-[0.5em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="••••••"
            />
          </Field>

          <Field label="New password">
            <PasswordInput
              value={newPassword}
              onChange={setNewPassword}
              show={showPw}
              onToggle={() => setShowPw((s) => !s)}
            />
          </Field>

          <Field label="Confirm new password">
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showPw}
              onToggle={() => setShowPw((s) => !s)}
            />
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Resetting password…" : "Reset password"}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={onResend}
            disabled={cooldown > 0 || loading}
            className="font-medium text-primary hover:underline disabled:opacity-50"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't receive a code? Resend"}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setStep("request");
                setOtp("");
              }}
              className="font-medium text-primary hover:underline"
            >
              Use a different email
            </button>
            <span>·</span>
            <Link to="/login" className="font-medium text-primary hover:underline">
              Back to log in
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your account email and we'll send you a 6-digit verification code."
    >
      <form onSubmit={onRequestCode} className="space-y-4">
        <Field label="Email address">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            maxLength={200}
            autoComplete="email"
            autoFocus
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="you@example.com"
          />
        </Field>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Sending code…" : "Send verification code"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthShell>
  );
}
