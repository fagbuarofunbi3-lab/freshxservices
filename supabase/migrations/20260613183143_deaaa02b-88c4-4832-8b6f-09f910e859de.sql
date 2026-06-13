CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_unique_flutterwave_topup
ON public.wallet_transactions (description)
WHERE type = 'credit' AND description LIKE 'Wallet top-up (Flutterwave %';

CREATE OR REPLACE FUNCTION public.credit_wallet_topup_atomic(
  _profile_id uuid,
  _amount numeric,
  _tx_ref text
)
RETURNS TABLE(
  already_processed boolean,
  new_balance numeric,
  amount numeric,
  profile_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _description text := 'Wallet top-up (Flutterwave ' || _tx_ref || ')';
  _inserted boolean;
BEGIN
  IF _profile_id IS NULL THEN
    RAISE EXCEPTION 'Missing profile id';
  END IF;
  IF _tx_ref IS NULL OR length(trim(_tx_ref)) = 0 THEN
    RAISE EXCEPTION 'Missing transaction reference';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  INSERT INTO public.wallet_transactions (profile_id, type, amount, description)
  VALUES (_profile_id, 'credit', round(_amount), _description)
  ON CONFLICT (description)
  WHERE type = 'credit' AND description LIKE 'Wallet top-up (Flutterwave %'
  DO NOTHING;

  _inserted := FOUND;

  IF _inserted THEN
    UPDATE public.profiles
    SET wallet_balance = wallet_balance + round(_amount)
    WHERE id = _profile_id
    RETURNING wallet_balance INTO new_balance;

    IF new_balance IS NULL THEN
      RAISE EXCEPTION 'Profile % not found', _profile_id;
    END IF;

    INSERT INTO public.notifications (profile_id, message, channel, type)
    VALUES (
      _profile_id,
      'Wallet topped up with ₦' || trim(to_char(round(_amount), 'FM999G999G999G999G990')) || '. New balance: ₦' || trim(to_char(new_balance, 'FM999G999G999G999G990')) || '.',
      'in_app',
      'topup'
    );

    RETURN QUERY SELECT false, new_balance, round(_amount), _profile_id;
  ELSE
    SELECT p.wallet_balance INTO new_balance
    FROM public.profiles p
    WHERE p.id = _profile_id;

    IF new_balance IS NULL THEN
      RAISE EXCEPTION 'Profile % not found', _profile_id;
    END IF;

    RETURN QUERY SELECT true, new_balance, round(_amount), _profile_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_wallet_topup_atomic(uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_wallet_topup_atomic(uuid, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION public.credit_wallet_topup_atomic(uuid, numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet_topup_atomic(uuid, numeric, text) TO service_role;