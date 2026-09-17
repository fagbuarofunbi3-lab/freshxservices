import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@/lib/create-fn";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { requestPasswordResetEmail, verifyEmailOTP } from "@/lib/auth.functions";
import { AuthShell } from "@/components/AuthShell";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/verify-otp")({
  validateSearch: (search: Record<string, unknown>): { email?: string; purpose?: string } => ({
    email: typeof search.email === "string" ? search.email : undefined,
    purpose: typeof search.purpose === "string" ? search.purpose : "reset_password",
  }),
  component: VerifyOtpPage,
});

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain || name.length <= 2) return email;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

function VerifyOtpPage() {
  const { email = "", purpose = "reset_password" } = Route.useSearch();
  const verifyFn = useServerFn(verifyEmailOTP);
  const resendFn = useServerFn(requestPasswordResetEmail);
  const navigate = useNavigate();

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  // 60-second cooldown timer for resending OTP
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleVerify(codeToVerify?: string) {
    const code = (codeToVerify || otp).trim();
    if (!email) {
      toast.error("Missing email address. Please start from the Forgot Password page.");
      navigate({ to: "/forgot-password" });
      return;
    }
    if (code.length !== 6) {
      toast.error("Please enter all 6 digits of the code");
      return;
    }

    setLoading(true);
    try {
      await verifyFn({
        data: {
          email,
          code,
          purpose,
        },
      });

      toast.success("Code verified successfully!");
      // Redirect to reset password with email and verified OTP
      await navigate({
        to: "/reset-password",
        search: { email, otp: code },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired verification code");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (cooldown > 0 || loading || !email) return;
    setLoading(true);
    try {
      await resendFn({ data: { email } });
      setCooldown(60);
      setOtp("");
      toast.success("A fresh 6-digit code has been sent to your email.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setLoading(false);
    }
  }

  if (!email) {
    return (
      <AuthShell title="Verification required" subtitle="No email address was provided.">
        <p className="text-sm text-muted-foreground text-center">
          Please enter your email on the forgot password page to request a verification code.
        </p>
        <div className="mt-6 text-center">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Go to Forgot Password
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Enter verification code"
      subtitle={`We sent a 6-digit code to ${maskEmail(email)}`}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleVerify();
        }}
        className="space-y-6"
      >
        <div className="flex flex-col items-center justify-center py-2">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={(val) => {
              const digitsOnly = val.replace(/\D/g, "");
              setOtp(digitsOnly);
              if (digitsOnly.length === 6) {
                handleVerify(digitsOnly);
              }
            }}
          >
            <InputOTPGroup className="gap-2 sm:gap-3">
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          <p className="mt-3 text-xs text-muted-foreground">
            Enter the 6 individual digits from your email.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || otp.length < 6}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Verifying code…" : "Verify code"}
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
          <Link
            to="/forgot-password"
            className="font-medium text-primary hover:underline"
          >
            Use a different email
          </Link>
          <span>·</span>
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to log in
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
