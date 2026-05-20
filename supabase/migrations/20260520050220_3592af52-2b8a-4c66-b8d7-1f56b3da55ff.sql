CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Wipe pre-launch test data so the NOT NULL password column is safe to add
DELETE FROM public.wallet_transactions;
DELETE FROM public.notifications;
DELETE FROM public.orders;
DELETE FROM public.profiles;

ALTER TABLE public.profiles
  ADD COLUMN password_hash TEXT NOT NULL;