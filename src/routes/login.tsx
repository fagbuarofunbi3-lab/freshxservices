import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@/lib/create-fn";
import { useState } from "react";
import { toast } from "sonner";
import { logIn } from "@/lib/auth.functions";
import { useInvalidateMe } from "./__root";
import { AuthShell, Field, PasswordInput } from "./signup";

const LOGIN_TITLE = "Log in to FreshX Services";
const LOGIN_DESC =
  "Sign in to your FreshX account to book laundry, cleaning and home services in Port Harcourt, track orders and manage your wallet.";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function waitForSessionReady() {
  return new Promise((resolve) => setTimeout(resolve, 120));
}

function LoginPage() {
  const fn = useServerFn(logIn);
  const navigate = useNavigate();
  const router = useRouter();
  const invalidate = useInvalidateMe();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await fn({ data: { whatsapp_number: phone, password } });
      await waitForSessionReady();
      await invalidate();
      await router.invalidate();
      toast.success("Welcome back!");
      await navigate({ to: result.role === "admin" ? "/admin" : "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in with your WhatsApp number and password.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="WhatsApp number">
          <div className="flex items-stretch overflow-hidden rounded-md border border-input">
            <span className="flex items-center bg-muted px-3 text-sm text-muted-foreground">+234</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="numeric"
              maxLength={14}
              className="w-full bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="801 234 5678"
            />
          </div>
        </Field>
        <Field label="Password">
          <PasswordInput value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw((s) => !s)} />
        </Field>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to="/forgot-password" className="font-medium text-primary hover:underline">
          Forgot password?
        </Link>
      </p>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
