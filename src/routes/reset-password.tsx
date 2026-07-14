import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resetPasswordWithToken, resetPasswordWithVerifiedEmail } from "@/lib/auth.functions";
import { AuthShell, Field, PasswordInput } from "./signup";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
    source: typeof search.source === "string" ? search.source : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, source } = Route.useSearch();
  const isBuiltInEmailLink = source === "auth";
  const tokenFn = useServerFn(resetPasswordWithToken);
  const verifiedEmailFn = useServerFn(resetPasswordWithVerifiedEmail);
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(isBuiltInEmailLink);

  useEffect(() => {
    if (!isBuiltInEmailLink) return;
    let cancelled = false;
    async function prepareEmailSession() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            url.searchParams.delete("code");
            window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
          }
        } else {
          await supabase.auth.getSession();
        }
      } finally {
        if (!cancelled) setCheckingLink(false);
      }
    }
    void prepareEmailSession();
    return () => {
      cancelled = true;
    };
  }, [isBuiltInEmailLink]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token && !isBuiltInEmailLink) return toast.error("Missing reset token. Open the link from your email again.");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      if (isBuiltInEmailLink) {
        await verifiedEmailFn({ data: { new_password: password } });
      } else {
        await tokenFn({ data: { token, new_password: password } });
      }
      toast.success("Password reset. You can now log in.");
      await navigate({ to: "/login", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  if (!token && !isBuiltInEmailLink) {
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
          disabled={loading || checkingLink}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {checkingLink ? "Verifying link…" : loading ? "Saving…" : "Save new password"}
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