
ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS promo_codes_owner_idx ON public.promo_codes(owner_profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_uq ON public.promo_codes(upper(code));

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_promo_commission_uq
  ON public.wallet_transactions(description)
  WHERE type = 'credit' AND description LIKE 'Promo commission (Flutterwave %';

CREATE OR REPLACE FUNCTION public.credit_promo_commission(
  _owner_profile_id uuid,
  _commission_amount numeric,
  _tx_ref text,
  _promo_code text
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _description text := 'Promo commission (Flutterwave ' || _tx_ref || ')';
  _new_balance numeric;
  _inserted boolean;
BEGIN
  IF _owner_profile_id IS NULL OR _commission_amount IS NULL OR _commission_amount <= 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.wallet_transactions (profile_id, type, amount, description)
  VALUES (_owner_profile_id, 'credit', round(_commission_amount), _description)
  ON CONFLICT (description) WHERE type = 'credit' AND description LIKE 'Promo commission (Flutterwave %'
  DO NOTHING;

  _inserted := FOUND;

  IF _inserted THEN
    UPDATE public.profiles
    SET wallet_balance = wallet_balance + round(_commission_amount)
    WHERE id = _owner_profile_id
    RETURNING wallet_balance INTO _new_balance;

    INSERT INTO public.notifications (profile_id, message, channel, type)
    VALUES (
      _owner_profile_id,
      'You earned ₦' || trim(to_char(round(_commission_amount), 'FM999G999G999G999G990')) ||
        ' commission from promo code ' || coalesce(_promo_code, '') || '. New balance: ₦' ||
        trim(to_char(_new_balance, 'FM999G999G999G999G990')) || '.',
      'in_app',
      'promo_commission'
    );

    UPDATE public.promo_codes
    SET times_used = coalesce(times_used, 0) + 1
    WHERE upper(code) = upper(_promo_code);
  END IF;

  RETURN _new_balance;
END;
$$;
