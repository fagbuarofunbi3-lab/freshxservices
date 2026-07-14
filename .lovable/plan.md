## FreshX Professionals — build plan

### 1. Database (one migration)

New tables in `public`:

- `professionals`
  - `id`, `profile_id` (unique, FK auth.users), `category` (enum: `hairdressing`, `barbering`, `hygiene`, `gas_refill`, `accommodation`), `business_name`, `slug` (unique, url-safe), `whatsapp_number`, `is_active`, timestamps.
- `professional_catalog_items`
  - `id`, `professional_id` FK, `image_url`, `title`, `price` numeric, `position` int. Max 8 enforced via trigger.
- `professional_reviews`
  - `id`, `professional_id` FK, `reviewer_profile_id` FK, `rating` 1–5, `comment`, `created_at`. Unique (professional, reviewer) — one review per user per pro, editable.

RLS + GRANTs:
- `professionals`: `SELECT TO anon, authenticated` where `is_active=true` (public shop pages). Owner (`profile_id = auth.uid()`) can UPDATE own row. Admin manages via service role (server fn).
- `professional_catalog_items`: `SELECT TO anon, authenticated`. Owner full CRUD scoped by professional ownership.
- `professional_reviews`: `SELECT TO anon, authenticated`. `INSERT/UPDATE/DELETE` where `reviewer_profile_id = auth.uid()`.

Slug generation: lowercase business_name, dashes, dedupe with numeric suffix — done in server fn.

### 2. Server functions

- `src/lib/professionals.functions.ts`
  - `adminPromoteToProfessional({ profileId, category })` — admin only via `has_role`. Creates row with placeholder business_name (`"<user name>'s shop"`) + slug.
  - `adminListProfessionals()` — admin view.
  - `adminUnsetProfessional({ id })`.
  - `getMyProfessional()` — for the pro's own dashboard.
  - `updateMyProfessional({ business_name, whatsapp_number })` — regenerates slug when business name changes (ensuring uniqueness).
  - `upsertCatalogItem({ id?, image_url, title, price, position })` — enforces max 8.
  - `deleteCatalogItem({ id })`.
  - `listProfessionalsByCategory({ category })` — public.
  - `getProfessionalBySlug({ slug })` — public, joins catalog + review aggregate.
  - `addOrUpdateReview({ professional_id, rating, comment })`.
  - `listReviews({ professional_id })`.

Image uploads reuse existing `site-media` bucket (path `professionals/<profileId>/...`).

### 3. Routes

New:
- `src/routes/_authenticated/professional.tsx` — pro dashboard (business name, WhatsApp, up to 8 catalog cards with image upload + price + title, shareable shop URL with copy button). Redirects to `/dashboard` if user is not a professional.
- `src/routes/_authenticated/order.category.$category.tsx` — list of professionals in that category (name + rating + tile → shop).
- `src/routes/shop.$slug.tsx` — public route. Loader fetches by slug. Uses `_authenticated` pattern via redirect: if not signed in, redirect to `/login?redirect=/shop/<slug>`. Shows business name, avg rating, catalog grid, reviews list + add-review form, booking form (location + special instructions + preferred time), "Book Now" → opens `wa.me/<pro-number>` with prefilled message including user's name and all fields.

Modified:
- `src/routes/_authenticated/order.new.tsx` — expand "What do you need?" from 2 tiles to 7: Laundry, Cleaning, Hairdressing, Barbering, Hygiene products, Gas refill, Accommodation. First two keep existing behavior; the other 5 route to `/order/category/<category>`.
- `src/routes/_authenticated/admin.customers.tsx` — add a "Make FreshX Professional" action beside the existing referral action. Opens a small modal to pick the category. Shows current professional status.
- Sidebar / nav wherever the "Referral Challenge" button lives (dashboard) — add a "My Professional Shop" link that appears only if `getMyProfessional()` returns a row.

### 4. Booking WhatsApp message format

```
Hi <business_name>, my name is <user full name>.
I'd like to book from your FreshX shop.

Service: <category label>
Preferred time: <schedule>
Location: <location>
Notes: <special instructions>

Sent from freshxservices.com.ng/shop/<slug>
```

### 5. Not changing

Existing laundry, cleaning, wallet, referral, promo, admin overview/orders, hero page — untouched.

### Technical notes

- Slug uniqueness handled in server fn with a small `while exists` loop appending `-2`, `-3`, etc.
- Reviews aggregate (avg rating, count) computed in `getProfessionalBySlug` via a SQL view or inline aggregate — inline aggregate for simplicity.
- Public shop route uses the `requireSupabaseAuth`-free public server fn pattern (server publishable client + narrow anon SELECT policies already granted above).
- Shop URL displayed: `${window.location.origin}/shop/<slug>`.
- Only ONE professional per user (unique `profile_id`). Admin can change category via update.
