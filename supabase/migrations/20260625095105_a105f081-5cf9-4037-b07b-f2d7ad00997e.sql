
REVOKE EXECUTE ON FUNCTION public.credit_promo_commission(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_promo_commission(uuid, numeric, text, text) TO service_role;
