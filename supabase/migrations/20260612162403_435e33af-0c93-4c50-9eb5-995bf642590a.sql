-- 1. Remove sensitive tables from realtime broadcast (app doesn't use realtime)
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
ALTER PUBLICATION supabase_realtime DROP TABLE public.wallet_transactions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;

-- 2. Add deny-all policies for anon/authenticated roles.
-- This app uses custom auth (password_hash on profiles) and accesses all data
-- via service_role server functions (which bypass RLS). Direct client access
-- via PostgREST is already blocked by lack of GRANTs; these policies make the
-- intent explicit and satisfy the "RLS enabled with no policy" findings.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','orders','wallet_transactions','notifications','promo_codes']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Deny all direct client access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Deny all direct client access" ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;
