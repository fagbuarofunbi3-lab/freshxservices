import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { resetPasswordWithToken } from "@/lib/auth.functions";
import { AuthShell, Field, PasswordInput } from "./signup";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const fn = useServerFn(resetPasswordWithToken);
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return toast.error("Missing reset token. Open the link from your email again.");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      await fn({ data: { token, new_password: password } });
      toast.success("Password reset. You can now log in.");
      await navigate({ to: "/login", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title="Reset password" subtitle="This link is missing its reset token.">
        <p className="text-sm text-muted-foreground">
          Open the reset link directly from your email. If it keeps failing, request a new one.
        </p>
        <div className="mt-6">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Request a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" subtitle="Choose a new password for your FreshX account.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="New password">
          <PasswordInput value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw((s) => !s)} />
        </Field>
        <Field label="Confirm new password">
          <PasswordInput value={confirm} onChange={setConfirm} show={showPw} onToggle={() => setShowPw((s) => !s)} />
        </Field>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save new password"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthShell>
  );
}