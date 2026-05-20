CREATE OR REPLACE FUNCTION public.crypt_password(plain text)
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT crypt(plain, gen_salt('bf', 10));
$$;

CREATE OR REPLACE FUNCTION public.verify_password(plain text, hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT crypt(plain, hash) = hash;
$$;

REVOKE ALL ON FUNCTION public.crypt_password(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_password(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crypt_password(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_password(text, text) TO service_role;