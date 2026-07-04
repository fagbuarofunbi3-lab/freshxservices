## Goal

Make FreshX the "partner company" step in TrustBridge Nigeria's referral game. TrustBridge is where the game starts and ends; FreshX just needs to (1) give each ambassador a real, shareable referral URL to paste back into TrustBridge, and (2) count signups/orders that come through it. No webhook to TrustBridge for now.

## What changes on FreshX

### 1. Public referral landing page `/r/[code]`

- New public route `src/routes/r.$code.tsx` (SSR, no auth gate).
- Loader looks up `referral_codes` by code (case-insensitive, `is_active = true`) using the server publishable client + a narrow `TO anon` SELECT policy on `referral_codes` for `code, is_active` only (no owner PII).
- If code is invalid/inactive → still render the page, but treat as "no code" (don't block signup).
- Page shows: FreshX intro, what the user gets, and a single big **"Sign up on FreshX"** CTA that navigates to `/signup?ref=CODE`.
- `head()` sets route-specific title/description/OG so WhatsApp previews look right.
- Mobile-first layout (this is the whole point — links open in WhatsApp browser).

### 2. Signup prefill from `?ref=`

- `src/routes/signup.tsx`: read `?ref=` on mount, uppercase it, and prefill the existing "Referral code" field. Field stays editable.
- No other signup logic changes — existing `signUp` server fn already accepts `referral_code` and increments `times_used`.

### 3. "Share your link" surface for ambassadors

The user pastes their FreshX link into TrustBridge, so they need to copy it easily.

- On the existing **Referral Challenge / Leaderboard** page (`src/routes/_authenticated/leaderboard.tsx`) and/or the ambassador dashboard section, add a "Your FreshX referral link" block for signed-in users who own a referral code:
  - Show `https://freshxservices.com.ng/r/CODE`
  - Copy button + native Share button (`navigator.share`) with prefilled WhatsApp text.
- Users without an admin-assigned code see a short note: "Ask admin to assign you a referral code to join the challenge."

### 4. Nothing changes for admin

- Admin section stays as-is. No TrustBridge tab, no webhook UI. (Skip webhook per user's answer.)

## The FreshX-side Lovable prompt (deliverable to paste into TrustBridge convo / keep for reference)

> **FreshX referral-link support for the TrustBridge Nigeria game**
>
> On FreshX (freshxservices.com.ng), add a public referral landing page at `/r/[code]` that anyone can open from a WhatsApp-shared link. The page shows a short FreshX intro and one big "Sign up on FreshX" button. Clicking it goes to `/signup?ref=[code]`, which prefills the existing Referral code field so the new signup is credited to the ambassador who owns that code. If the code is missing or inactive, still let them sign up normally without a code.
>
> Every FreshX user who has been assigned a referral code by admin should see their personal shareable link `https://freshxservices.com.ng/r/[their code]` on the Referral Challenge page, with Copy and Share (WhatsApp) buttons. This is the link they paste into TrustBridge's Game Instructions page so TrustBridge can wrap it as `trustbridge.com.ng/g/[their trustbridge code]`.
>
> The existing FreshX referral tracking (times used, monthly signups, active users who placed an order) already powers the leaderboard, so no extra counters are needed. Do not add any TrustBridge webhook or cross-site callback for now. Keep the whole flow mobile-first since users open these links inside WhatsApp.
>
> Do not touch admin screens, order flow, wallet, or any other feature.

## Technical notes

- New file: `src/routes/r.$code.tsx` (public, SSR).
- Edited: `src/routes/signup.tsx` (read `?ref=`), `src/routes/_authenticated/leaderboard.tsx` (share block).
- Migration: add `TO anon` SELECT policy on `referral_codes` limited to `code, is_active` (or add a small `getPublicReferralCode` server fn using the publishable-key client so we don't widen anon reads).
- No changes to `referrals.functions.ts`, orders, admin, or auth middleware.
