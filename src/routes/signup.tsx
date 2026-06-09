import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { signUp } from "@/lib/auth.functions";
import { useInvalidateMe } from "./__root";

export const Route = createFileRoute("/signup")({ component: SignUpPage });

function waitForSessionReady() {
  return new Promise((resolve) => setTimeout(resolve, 120));
}

function SignUpPage() {
  const fn = useServerFn(signUp);
  const navigate = useNavigate();
  const router = useRouter();
  const invalidate = useInvalidateMe();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await fn({ data: { full_name: fullName, whatsapp_number: phone, email, password } });
      await waitForSessionReady();
      await invalidate();
      await router.invalidate();
      toast.success("Welcome to FreshX!");
      await navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create your FreshX account" subtitle="Name, WhatsApp number, email and a password.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Full name">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Emeka Johnson"
          />
        </Field>
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
        <Field label="Email (for password recovery)">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            maxLength={200}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>
        <Field label="Password">
          <PasswordInput value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw((s) => !s)} />
          <span className="mt-1 block text-xs text-muted-foreground">Use at least 8 characters.</span>
        </Field>
        <Field label="Confirm password">
          <PasswordInput value={confirm} onChange={setConfirm} show={showPw} onToggle={() => setShowPw((s) => !s)} />
        </Field>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}

export function PasswordInput({
  value,
  onChange,
  show,
  onToggle,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={8}
        maxLength={200}
        type={show ? "text" : "password"}
        className="w-full rounded-md border border-input bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        placeholder="••••••••"
        autoComplete="current-password"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute inset-y-0 right-2 my-auto flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--surface)]">
      <div className="freshx-blob" style={{ background: "var(--color-primary)", width: 400, height: 400, top: -100, left: -100 }} />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Link to="/" className="mb-8 font-display text-2xl font-bold">
          Fresh<span className="text-primary">X</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-7 shadow-xl shadow-primary/5">
          <h1 className="font-display text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
