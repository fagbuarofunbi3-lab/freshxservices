import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@/lib/create-fn";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { signUp, googleAuth } from "@/lib/auth.functions";
import { useInvalidateMe } from "./__root";
import { GoogleSignInButton, getGoogleTokenFromUrl } from "@/components/GoogleSignInButton";
import { AuthShell, Field, PasswordInput } from "@/components/AuthShell";

const SIGNUP_TITLE = "Create your FreshX account — Laundry & Cleaning, Port Harcourt";
const SIGNUP_DESC =
  "Sign up for FreshX in under a minute to book laundry pickup, dry cleaning, home cleaning, gas refill and more across Port Harcourt, Nigeria.";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): { ref?: string } => ({
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
  component: SignUpPage,
});

function waitForSessionReady() {
  return new Promise((resolve) => setTimeout(resolve, 120));
}

function SignUpPage() {
  const fn = useServerFn(signUp);
  const googleFn = useServerFn(googleAuth);
  const navigate = useNavigate();
  const router = useRouter();
  const invalidate = useInvalidateMe();
  const { ref } = Route.useSearch();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [referralCode, setReferralCode] = useState(
    (ref ?? "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40),
  );
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // Google Signup phone completion state
  const [googleData, setGoogleData] = useState<{
    idToken: string;
    email?: string;
    fullName?: string;
  } | null>(null);
  const [googlePhone, setGooglePhone] = useState("");

  useEffect(() => {
    const { idToken, state: returnedState, error } = getGoogleTokenFromUrl();
    if (error) {
      toast.error(`Google sign-up error: ${error}`);
      return;
    }
    if (idToken) {
      let refToUse = referralCode;
      if (returnedState) {
        try {
          const parsed = JSON.parse(returnedState);
          if (parsed.ref) refToUse = parsed.ref;
        } catch {
          if (returnedState.trim()) refToUse = returnedState;
        }
      }
      if (!refToUse) {
        try {
          refToUse = sessionStorage.getItem("freshx_pending_state") || "";
          sessionStorage.removeItem("freshx_pending_state");
        } catch {}
      }
      handleGoogleSuccess(idToken, refToUse);
    }
  }, []);

  async function handleGoogleSuccess(idToken: string, overrideRef?: string) {
    setLoading(true);
    try {
      const code = (overrideRef !== undefined ? overrideRef : referralCode).trim() || undefined;
      const res = await googleFn({
        data: {
          id_token: idToken,
          referral_code: code,
        },
      });

      if (res.needs_phone) {
        setGoogleData({
          idToken,
          email: res.email,
          fullName: res.full_name,
        });
        toast.info("Please enter your WhatsApp number to finish setting up your account.");
        return;
      }

      await waitForSessionReady();
      await invalidate();
      await router.invalidate();
      toast.success("Welcome to FreshX!");
      await navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-up failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleCompletePhone(e: React.FormEvent) {
    e.preventDefault();
    if (!googleData) return;
    if (!googlePhone.trim()) {
      toast.error("Please enter your WhatsApp number");
      return;
    }

    setLoading(true);
    try {
      const res = await googleFn({
        data: {
          id_token: googleData.idToken,
          whatsapp_number: googlePhone,
          referral_code: referralCode.trim() || undefined,
        },
      });

      if (res.token) {
        await waitForSessionReady();
        await invalidate();
        await router.invalidate();
        toast.success("Welcome to FreshX!");
        await navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete signup");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await fn({
        data: {
          full_name: fullName,
          whatsapp_number: phone,
          email,
          password,
          referral_code: referralCode.trim() || undefined,
        },
      });
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

  if (googleData) {
    return (
      <AuthShell
        title="Almost done!"
        subtitle={`Welcome, ${googleData.fullName || googleData.email}! Enter your WhatsApp number to receive delivery updates.`}
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
          <Field label="Referral code (optional)">
            <input
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              maxLength={40}
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. FRIEND20"
            />
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
    <AuthShell title="Create your FreshX account" subtitle="Enter your details below to get started.">
      <div className="mb-4">
        <GoogleSignInButton
          text="signup_with"
          disabled={loading}
          state={referralCode ? JSON.stringify({ ref: referralCode }) : undefined}
        />
        <div className="relative my-4 text-center text-xs after:absolute after:inset-0 after:top-1/2 after:border-t after:border-border">
          <span className="relative bg-card px-2 text-muted-foreground">or register with email</span>
        </div>
      </div>
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
          <span className="mt-1 block text-xs text-muted-foreground">Use at least 8 characters.</span>
        </Field>
        <Field label="Confirm password">
          <PasswordInput value={confirm} onChange={setConfirm} show={showPw} onToggle={() => setShowPw((s) => !s)} />
        </Field>
        <Field label="Referral code (optional)">
          <input
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            maxLength={40}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 font-mono text-sm tracking-wider outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Got a code? Enter it here"
          />
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

export { AuthShell, Field, PasswordInput } from "@/components/AuthShell";

