## Goal

1. Require a password on signup and login (in addition to WhatsApp number + name).
2. Fix the bug where logging in does not show the dashboard.

## 1. Password support

Database (migration):
- Add `password_hash TEXT NOT NULL` column to `profiles`.
- Use `pgcrypto` extension and `crypt()` / `gen_salt('bf')` (bcrypt) to hash and verify passwords on the server side via the admin client. No plaintext passwords ever stored or logged.
- Minimum length: 8 chars. No max email-style complexity rules (Nigerian-market friendly).

Server functions (`src/lib/auth.functions.ts`):
- `signUp` now takes `{ full_name, whatsapp_number, password }`. Inserts profile with `password_hash = crypt(password, gen_salt('bf'))`.
- `logIn` now takes `{ whatsapp_number, password }`. Looks up profile and verifies with `password_hash = crypt(password, password_hash)`. Generic error message on failure ("Invalid WhatsApp number or password") to avoid user enumeration.
- `updateProfile` gets an optional `new_password` field so users can change their password from Settings later (Phase 1: just add to the server fn; the Settings UI can be wired in a follow-up if you want).

UI:
- `src/routes/signup.tsx`: add a Password field (type=password, min 8) and a "Show password" toggle.
- `src/routes/login.tsx`: add a Password field with the same toggle.
- Both forms get a subtle "Use at least 8 characters" hint.

## 2. Dashboard-after-login fix

Root cause: `login` / `signup` call `useInvalidateMe()` which only invalidates the `useMe` React Query cache. But `/_authenticated.beforeLoad` calls `getMe()` directly, and TanStack Router caches that result for the current match. When `navigate({ to: "/dashboard" })` fires, the router does not re-run `beforeLoad`, sees the cached `null`, and redirects back to `/login` (or shows a flash and stays put).

Fix:
- After successful `signUp` / `logIn`, also call `router.invalidate()` (from `useRouter()`) before navigating. This forces `beforeLoad` to re-run with the freshly-set session cookie.
- Apply the same fix in `logOut` so signing out properly clears protected route state.

## Files changed

- `supabase/migrations/<new>.sql` — add `pgcrypto`, add `password_hash` column.
- `src/lib/auth.functions.ts` — password hashing + verification, schema updates.
- `src/routes/signup.tsx` — password field, router invalidate.
- `src/routes/login.tsx` — password field, router invalidate.
- `src/routes/_authenticated.tsx` — router invalidate on logout.

## Out of scope (for this turn)

- Password reset flow (no email/SMS configured yet — would need OTP via WhatsApp later).
- Settings UI for changing password (server fn will support it; UI can come next).

## Existing accounts

The migration adds `password_hash` as NOT NULL with a placeholder for any existing rows. Since this is still pre-launch and accounts were test-only, the safest move is to wipe existing `profiles` rows in the same migration so everyone re-signs-up with a password. Confirm if you'd rather keep them and force a reset instead.