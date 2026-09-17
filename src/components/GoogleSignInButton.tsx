import { useState } from "react";
import { toast } from "sonner";

export interface GoogleSignInButtonProps {
  onSuccess?: (idToken: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
  disabled?: boolean;
  redirectUri?: string;
  state?: string;
}

/**
 * Extracts and cleans Google OAuth token/error from window.location.hash
 * Uses the standard OpenID Connect implicit redirect flow on the same page.
 */
export function getGoogleTokenFromUrl(): {
  idToken: string | null;
  state: string | null;
  error: string | null;
} {
  if (typeof window === "undefined") {
    return { idToken: null, state: null, error: null };
  }

  // Google OIDC returns tokens in the hash fragment: #id_token=...&state=...
  const rawHash = window.location.hash;
  if (!rawHash || (!rawHash.includes("id_token=") && !rawHash.includes("error="))) {
    return { idToken: null, state: null, error: null };
  }

  const hashString = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
  const params = new URLSearchParams(hashString);
  const idToken = params.get("id_token");
  const error = params.get("error") || params.get("error_description");
  const state = params.get("state");

  if (idToken || error) {
    // Clean hash from browser URL bar without triggering a page reload
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", cleanUrl);
  }

  return { idToken, state, error };
}

export function GoogleSignInButton({
  text = "continue_with",
  disabled,
  redirectUri,
  state,
}: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);

  const clientId =
    (typeof import.meta !== "undefined" &&
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID) ||
    "";

  function handleClick() {
    if (!clientId) {
      toast.info(
        "Google Sign-In is ready! Please configure VITE_GOOGLE_CLIENT_ID in your .env file.",
      );
      return;
    }

    setLoading(true);

    const origin = window.location.origin;
    const cleanPath = window.location.pathname.replace(/\/$/, "") || "";
    const effectiveRedirectUri = redirectUri || `${origin}${cleanPath}`;

    // Nonce protects against replay attacks in OIDC
    const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
    try {
      sessionStorage.setItem("freshx_google_nonce", nonce);
      if (state) {
        sessionStorage.setItem("freshx_pending_state", state);
      }
    } catch {}

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: effectiveRedirectUri,
      response_type: "id_token",
      scope: "openid email profile",
      nonce: nonce,
      prompt: "select_account",
    });

    if (state) {
      params.set("state", state);
    }

    // Direct same-page navigation (no popups, opens right in the same tab)
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  const buttonLabel =
    text === "signup_with"
      ? "Sign up with Google"
      : text === "signin_with"
        ? "Sign in with Google"
        : "Continue with Google";

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className="flex w-full items-center justify-center gap-3 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/60 disabled:opacity-50 active:scale-[0.99]"
      >
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>{loading ? "Redirecting to Google…" : buttonLabel}</span>
      </button>
    </div>
  );
}
