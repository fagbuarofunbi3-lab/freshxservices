
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON public.profiles (lower(email)) WHERE email IS NOT NULL;

-- Wipe demo/manual credits; keep debit history for record-keeping
DELETE FROM public.wallet_transactions
WHERE type = 'credit'
  AND (description IS NULL OR description NOT LIKE 'Wallet top-up (Flutterwave%');

-- Reset every wallet balance to 0. Only future verified Flutterwave top-ups will credit it.
UPDATE public.profiles SET wallet_balance = 0;
