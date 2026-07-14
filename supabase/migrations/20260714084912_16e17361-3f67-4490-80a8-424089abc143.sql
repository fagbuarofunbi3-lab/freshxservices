
-- Category enum
DO $$ BEGIN
  CREATE TYPE public.professional_category AS ENUM (
    'hairdressing','barbering','hygiene','gas_refill','accommodation'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============== professionals ===============
CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  category public.professional_category NOT NULL,
  business_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  whatsapp_number TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.professionals TO authenticated;
GRANT ALL ON public.professionals TO service_role;

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "professionals_select_authenticated"
  ON public.professionals FOR SELECT TO authenticated
  USING (is_active = true OR profile_id = auth.uid());

CREATE POLICY "professionals_update_own"
  ON public.professionals FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

CREATE TRIGGER professionals_touch_updated_at
  BEFORE UPDATE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============== professional_catalog_items ===============
CREATE TABLE public.professional_catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX professional_catalog_items_pid_idx
  ON public.professional_catalog_items(professional_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_catalog_items TO authenticated;
GRANT ALL ON public.professional_catalog_items TO service_role;

ALTER TABLE public.professional_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_select_authenticated"
  ON public.professional_catalog_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "catalog_owner_all"
  ON public.professional_catalog_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.professionals p
                 WHERE p.id = professional_id AND p.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.professionals p
                      WHERE p.id = professional_id AND p.profile_id = auth.uid()));

CREATE TRIGGER catalog_touch_updated_at
  BEFORE UPDATE ON public.professional_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enforce max 8 items per professional
CREATE OR REPLACE FUNCTION public.enforce_catalog_max()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _count INT;
BEGIN
  SELECT count(*) INTO _count FROM public.professional_catalog_items
    WHERE professional_id = NEW.professional_id;
  IF _count >= 8 THEN
    RAISE EXCEPTION 'Catalog is limited to 8 items';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER catalog_max_items
  BEFORE INSERT ON public.professional_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_catalog_max();

-- =============== professional_reviews ===============
CREATE TABLE public.professional_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  reviewer_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (professional_id, reviewer_profile_id)
);

CREATE INDEX professional_reviews_pid_idx ON public.professional_reviews(professional_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_reviews TO authenticated;
GRANT ALL ON public.professional_reviews TO service_role;

ALTER TABLE public.professional_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select_authenticated"
  ON public.professional_reviews FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "reviews_insert_own"
  ON public.professional_reviews FOR INSERT TO authenticated
  WITH CHECK (reviewer_profile_id = auth.uid());

CREATE POLICY "reviews_update_own"
  ON public.professional_reviews FOR UPDATE TO authenticated
  USING (reviewer_profile_id = auth.uid())
  WITH CHECK (reviewer_profile_id = auth.uid());

CREATE POLICY "reviews_delete_own"
  ON public.professional_reviews FOR DELETE TO authenticated
  USING (reviewer_profile_id = auth.uid());

CREATE TRIGGER reviews_touch_updated_at
  BEFORE UPDATE ON public.professional_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
