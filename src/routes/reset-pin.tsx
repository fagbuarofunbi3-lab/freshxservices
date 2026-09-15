import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@/lib/create-fn";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { resetTransactionPinWithToken, resetTransactionPinWithVerifiedEmail } from "@/lib/auth.functions";
import { AuthShell, Field } from "./signup";

export const Route = createFileRoute("/reset-pin")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
    source: typeof search.source === "string" ? search.source : "",
  }),
  component: ResetPinPage,
});

function ResetPinPage() {
  const { token, source } = Route.useSearch();
  const isBuiltInEmailLink = source === "auth";
  const tokenFn = useServerFn(resetTransactionPinWithToken);
  const verifiedEmailFn = useServerFn(resetTransactionPinWithVerifiedEmail);
  const navigate = useNavigate();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(false);

  useEffect(() => {
    if (isBuiltInEmailLink) {
      setCheckingLink(false);
    }
  }, [isBuiltInEmailLink]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token && !isBuiltInEmailLink) return toast.error("Missing reset token. Open the link from your email again.");
    if (!/^\d{4}$/.test(next)) return toast.error("PIN must be exactly 4 digits");
    if (next !== confirm) return toast.error("PINs do not match");
    setLoading(true);
    try {
      if (isBuiltInEmailLink) {
        await verifiedEmailFn({ data: { new_pin: next } });
      } else {
        await tokenFn({ data: { token, new_pin: next } });
      }
      toast.success("Your transaction PIN has been reset.");
      await navigate({ to: "/login", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset PIN");
    } finally {
      setLoading(false);
    }
  }

  if (!token && !isBuiltInEmailLink) {
    return (
      <AuthShell title="Reset transaction PIN" subtitle="This link is missing its reset token.">
        <p className="text-sm text-muted-foreground">
          Open the reset link directly from your email. If it keeps failing, request a new one from
          Settings → Transaction PIN.
        </p>
        <div className="mt-6">
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">
            Back to log in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new transaction PIN"
      subtitle="Choose a new 4-digit PIN. You'll use it to authorise wallet payments for orders."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="New PIN">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={next}
            onChange={(e) => setNext(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-center text-sm tracking-[0.5em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="••••"
            required
          />
        </Field>
        <Field label="Confirm new PIN">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-center text-sm tracking-[0.5em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="••••"
            required
          />
        </Field>
        <button
          type="submit"
          disabled={loading || checkingLink}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {checkingLink ? "Verifying link…" : loading ? "Saving…" : "Save new PIN"}
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
