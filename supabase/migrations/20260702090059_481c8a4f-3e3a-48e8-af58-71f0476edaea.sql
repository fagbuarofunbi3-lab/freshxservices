
-- Referral codes table
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  reward_amount numeric not null default 0,
  times_used integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny direct client access to referral_codes"
  ON public.referral_codes AS RESTRICTIVE FOR ALL
  TO anon, authenticated USING (false) WITH CHECK (false);

-- Track referred_by_code on profile
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_code text;

-- Storage policies for site-media bucket (private, but readable by anyone for public display)
CREATE POLICY "site-media public read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'site-media');
