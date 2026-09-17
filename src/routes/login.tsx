import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@/lib/create-fn";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { logIn, googleAuth, isAdminRole } from "@/lib/auth.functions";
import { useInvalidateMe } from "./__root";
import { AuthShell, Field, PasswordInput } from "@/components/AuthShell";
import { GoogleSignInButton, getGoogleTokenFromUrl } from "@/components/GoogleSignInButton";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function waitForSessionReady() {
  return new Promise((resolve) => setTimeout(resolve, 120));
}

function LoginPage() {
  const fn = useServerFn(logIn);
  const googleFn = useServerFn(googleAuth);
  const navigate = useNavigate();
  const router = useRouter();
  const invalidate = useInvalidateMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // Google phone completion state if user is new
  const [googleData, setGoogleData] = useState<{
    idToken: string;
    email?: string;
    fullName?: string;
  } | null>(null);
  const [googlePhone, setGooglePhone] = useState("");

  useEffect(() => {
    const { idToken, error } = getGoogleTokenFromUrl();
    if (error) {
      toast.error(`Google sign-in error: ${error}`);
      return;
    }
    if (idToken) {
      handleGoogleSuccess(idToken);
    }
  }, []);

  async function handleGoogleSuccess(idToken: string) {
    setLoading(true);
    try {
      const result = await googleFn({ data: { id_token: idToken } });

      if (result.needs_phone) {
        setGoogleData({
          idToken,
          email: result.email,
          fullName: result.full_name,
        });
        toast.info("Please enter your WhatsApp number to complete account setup.");
        return;
      }

      await waitForSessionReady();
      await invalidate();
      await router.invalidate();
      toast.success("Welcome back!");
      const target = result.user && isAdminRole(result.user.role) ? "/admin" : "/dashboard";
      await navigate({ to: target, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleCompletePhone(e: React.FormEvent) {
    e.preventDefault();
    if (!googleData || !googlePhone.trim()) return;

    setLoading(true);
    try {
      const result = await googleFn({
        data: {
          id_token: googleData.idToken,
          whatsapp_number: googlePhone,
        },
      });

      if (result.token) {
        await waitForSessionReady();
        await invalidate();
        await router.invalidate();
        toast.success("Welcome to FreshX!");
        await navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete registration");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await fn({ data: { email, password } });
      await waitForSessionReady();
      await invalidate();
      await router.invalidate();
      toast.success("Welcome back!");
      const target = isAdminRole(result.role) ? "/admin" : "/dashboard";
      await navigate({ to: target, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  if (googleData) {
    return (
      <AuthShell
        title="Almost done!"
        subtitle={`Welcome, ${googleData.fullName || googleData.email}! Enter your WhatsApp number to complete signup.`}
      >
        <form onSubmit={handleGoogleCompletePhone} className="space-y-4">
          <Field label="WhatsApp number">
            <div className="flex items-stretch overflow-hidden rounded-md border border-input">
              <span className="flex items-center bg-muted px-3 text-sm text-muted-foreground">+234</span>
              <input
                value={googlePhone}
                onChange={(e) => setGooglePhone(e.target.value)}
                required
                autoFocus
                inputMode="numeric"
                maxLength={14}
                className="w-full bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="801 234 5678"
              />
            </div>
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Completing setup…" : "Complete registration"}
          </button>
          <button
            type="button"
            onClick={() => setGoogleData(null)}
            className="w-full text-center text-xs text-muted-foreground hover:underline"
          >
            Cancel and return
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in with your account credentials.">
      <div className="mb-4">
        <GoogleSignInButton onSuccess={handleGoogleSuccess} text="signin_with" disabled={loading} />
        <div className="relative my-4 text-center text-xs after:absolute after:inset-0 after:top-1/2 after:border-t after:border-border">
          <span className="relative bg-card px-2 text-muted-foreground">or continue with email</span>
        </div>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email address">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            maxLength={200}
            autoComplete="email"
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="you@example.com"
          />
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
