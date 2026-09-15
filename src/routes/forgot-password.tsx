import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@/lib/create-fn";
import { useState } from "react";
import { toast } from "sonner";
import { requestPasswordResetEmail } from "@/lib/auth.functions";
import { AuthShell, Field } from "./signup";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const sendEmailFn = useServerFn(requestPasswordResetEmail);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Please enter your email address");
      return;
    }

    setLoading(true);
    try {
      await sendEmailFn({ data: { email: cleanEmail } });
      toast.success("Verification code sent to your email!");
      // Redirect to the OTP verification page with individual digit boxes
      await navigate({
        to: "/verify-otp",
        search: { email: cleanEmail, purpose: "reset_password" },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your account email and we'll send you a verification code."
    >
      <form onSubmit={onSubmit} className="space-y-4">
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
