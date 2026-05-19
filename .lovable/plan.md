
# FreshX Services — Phase 1 MVP Plan

A focused first slice of the full brief. We build the customer experience end-to-end with the FreshX brand, real data persistence, and real-time order/wallet updates. Payments and WhatsApp are intentionally stubbed so we can finish a polished, working app fast; both are designed to slot in cleanly later.

## What's in Phase 1

1. Landing page — hero, How It Works, Services, Why FreshX, Testimonials, footer
2. Sign Up — full name + WhatsApp number (+234), creates account, sets session
3. Log In — WhatsApp number lookup, signs in
4. Customer Dashboard — wallet card, active order tracker, recent orders, notifications bell
5. Order Builder — multi-step (service → items / space → delivery → summary), live total, promo code field
6. Order History — filter, search, repeat order
7. Wallet — balance, transactions, Top-Up modal (stubbed "mark as paid" + manual bank transfer info)
8. Settings — language toggle (EN / Pidgin), edit name + WhatsApp number, sign out

## What's stubbed in Phase 1 (added later)

- Flutterwave checkout — UI present; "Pay" button credits wallet via a server fn placeholder. We swap in real Flutterwave when we wire Phase 3.
- WhatsApp notifications — every event that would send a WhatsApp message instead writes a record to a `notifications` table and shows in the in-app bell. The trigger points are already in the server functions, so wiring Twilio later is a single integration.
- Admin pages (8–12) — not in Phase 1. Seeded `service_items` and `promo_codes` via SQL so the customer flow works. Admin UI ships in Phase 2.
- Referrals, loyalty points, recurring cleaning, ratings — Phase 3 polish.
- OTP / PIN — replaced per your direction with simple name + WhatsApp auth.

## Auth approach (per your answer)

Custom lightweight auth: user signs up with full name + WhatsApp number. We store a row in `profiles` keyed by WhatsApp number (unique), generate a long random session token stored httpOnly cookie via a server fn, and validate it on protected routes via `_authenticated` layout. Profile fields (name, WhatsApp number, language) are editable from Settings. No password, no OTP — exactly as requested. We'll note clearly in the UI that this is light-touch auth and recommend layering OTP later.

## Brand system

Wired into `src/styles.css` as design tokens — never hardcoded in components.

- Primary `#1A56DB`, Light Blue `#EFF6FF`, Dark Navy `#0A0F1E`, Light Grey `#F8FAFF`, Borders `#E2E8F0`, Text `#1E293B` / `#64748B`, Success `#10B981`, Warning `#F59E0B`, Danger `#EF4444`
- Fonts: Syne (headings 700/800), DM Sans (body 300–500) — loaded from Google Fonts in `__root.tsx`
- Radii: 8px buttons, 12px cards, 24px pills (Tailwind token overrides)
- Framer Motion for page transitions, step animations, wallet counter, status tracker pulse
- Glassmorphism dashboard cards, floating blue blobs on landing

## Data model (Lovable Cloud / Supabase)

```text
profiles            id, full_name, whatsapp_number (unique), wallet_balance,
                    role ('customer'|'admin'), language_preference, created_at
sessions            id, profile_id, token_hash, expires_at, created_at
service_items       id, category, name, price, is_active, created_at
orders              id, profile_id, service_type, items_json, subtotal,
                    delivery_fee, discount_amount, total_amount,
                    promo_code_id, delivery_method, address,
                    special_instructions, status, rating, created_at, updated_at
wallet_transactions id, profile_id, type, amount, description, order_id, created_at
promo_codes         id, code, type, value, min_order_amount, expiry_date,
                    usage_limit, times_used, is_active, created_at
notifications       id, profile_id, message, channel ('in_app'|'whatsapp_pending'),
                    is_read, type, created_at
```

Order status enum: `pending | received | washing | ready | delivered | cancelled`.

Seed data: full Soft / Hard / Bedding laundry catalog + apartment + office cleaning items + one promo code `FRESH10` (10% off).

## Routes (TanStack Start)

```text
/                              landing
/signup                        sign up
/login                         log in
/_authenticated/dashboard      customer dashboard
/_authenticated/order/new      order builder (multi-step in one route)
/_authenticated/orders         order history
/_authenticated/orders/$id     order detail
/_authenticated/wallet         wallet + top-up
/_authenticated/settings       profile + language toggle + logout
```

`/_authenticated.tsx` gates child routes via `beforeLoad` calling a `getMe` server fn.

## Server functions (all in `src/lib/*.functions.ts`)

- `auth.functions.ts` — `signUp`, `logIn`, `getMe`, `logOut`, `updateProfile`
- `orders.functions.ts` — `listServiceItems`, `createOrder`, `listMyOrders`, `getOrder`, `repeatOrder`, `applyPromo`
- `wallet.functions.ts` — `getBalance`, `listTransactions`, `topUpStub` (marks deposit complete; ready to swap for Flutterwave webhook), `creditFromAdmin` (Phase 2)
- `notifications.functions.ts` — `listMine`, `markAllRead`, internal `queueNotification` helper used everywhere a WhatsApp message would be sent

All writes also `INSERT` into `notifications` for the trigger points in the brief (new order → admin, status change → customer, wallet debit → customer, top-up → customer, low balance → customer). When we wire Twilio later, a single worker drains `notifications WHERE channel='whatsapp_pending'`.

## Real-time

Supabase Realtime subscriptions on `orders` (status changes) and `wallet_transactions` (balance updates) so the dashboard, order tracker, and wallet refresh without reload.

## Language toggle

Tiny i18n dictionary (English + Pidgin) at `src/lib/i18n.ts`, keyed strings used across customer surfaces. Preference stored in `profiles.language_preference` and mirrored to `localStorage`. Covers strings listed in the brief plus all CTAs / status labels.

## Out of scope for Phase 1 (explicit)

- Admin pages 8–12 (Phase 2)
- Real Flutterwave checkout (Phase 3 — keys are ready, we'll wire then)
- Real Twilio / WhatsApp sending (when credentials arrive)
- OTP / PIN auth, password reset, leaked-password check
- Referral system, loyalty points, recurring cleaning, ratings
- Revenue charts, CSV export, manual admin deductions

## Technical notes (for reference)

- Server fns use `requireSupabaseAuth` only for admin Phase 2 work; Phase 1 auth uses our custom session-cookie middleware over `supabaseAdmin`, because the customer table isn't Supabase Auth users.
- RLS enabled on every table; policies scoped by `profile_id = current_setting('app.profile_id')::uuid` set by middleware OR all access funneled through server fns using `supabaseAdmin` with explicit `profile_id` filters (we'll pick funnel approach — simpler and matches our custom auth).
- All Supabase admin code lives in `*.functions.ts` files importing `client.server` — no client leakage.
- Wallet top-up stub is gated behind a clearly labeled "Demo top-up" button so it's obvious it isn't a real charge.

## Acceptance for Phase 1

A new user can: land on `/`, sign up with name + WhatsApp number, see an empty dashboard, demo-top-up ₦5,000, build a laundry order with promo `FRESH10`, confirm it (wallet debited, order created with status `received`), watch status update in real time when we manually flip it in the DB, see it in Order History, repeat the order, toggle to Pidgin, log out, log back in.

After you approve, I'll enable Lovable Cloud, create the schema + seed data, then build the routes top-to-bottom.
