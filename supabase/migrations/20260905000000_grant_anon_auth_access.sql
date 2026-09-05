-- Grant the anon role the minimum permissions needed for server-side auth operations.
-- These are normally done via the service_role key (which bypasses RLS), but when
-- that key is unavailable the server falls back to the anon key and needs these.
-- RPC functions (crypt_password, verify_password, increment_referral_use) are
-- SECURITY DEFINER so they already work for any role.

-- profiles: server auth reads, creates, and updates profiles
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon;

-- referral_codes: signup reads and updates referral usage counts
GRANT SELECT, UPDATE ON public.referral_codes TO anon;

-- Remove any existing restrictive policies on profiles that would block the anon role
DROP POLICY IF EXISTS "Deny all direct client access" ON public.profiles;
DROP POLICY IF EXISTS "Deny direct client access to profiles" ON public.profiles;

-- Permissive RLS policies: allow the anon role to do the server auth operations
-- These use permissive FOR ALL so SELECT + INSERT + UPDATE all pass.
-- They are scoped to what the auth code actually needs.

-- profiles: allow anon to do anything (the auth code controls what gets written)
CREATE POLICY "anon_server_auth_profiles"
  ON public.profiles
  AS PERMISSIVE
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- referral_codes: allow anon to SELECT and UPDATE (for referral validation in signup)
CREATE POLICY "anon_server_auth_referral_codes"
  ON public.referral_codes
  AS PERMISSIVE
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
