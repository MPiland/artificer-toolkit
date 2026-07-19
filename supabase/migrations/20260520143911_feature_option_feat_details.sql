CREATE TABLE IF NOT EXISTS public.feature_details (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  detail_id uuid NOT NULL REFERENCES public.details (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, detail_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_details_feature ON public.feature_details (feature_id);

ALTER TABLE public.feature_details ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.option_details (
  option_id uuid NOT NULL REFERENCES public.options (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  detail_id uuid NOT NULL REFERENCES public.details (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,
  PRIMARY KEY (option_id, detail_id)
);

CREATE INDEX IF NOT EXISTS idx_option_details_option ON public.option_details (option_id);

ALTER TABLE public.option_details ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feat_details (
  feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  detail_id uuid NOT NULL REFERENCES public.details (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,
  PRIMARY KEY (feat_id, detail_id)
);

CREATE INDEX IF NOT EXISTS idx_feat_details_feat ON public.feat_details (feat_id);

ALTER TABLE public.feat_details ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.features DROP COLUMN IF EXISTS detail;
ALTER TABLE public.options DROP COLUMN IF EXISTS detail;
ALTER TABLE public.feats DROP COLUMN IF EXISTS detail;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_details_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_details_owned
    AFTER DELETE ON public.feature_details
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.details",
      "columns": ["detail_id"]
    }]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_details_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_details_owned
    AFTER DELETE ON public.option_details
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.details",
      "columns": ["detail_id"]
    }]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_details_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_details_owned
    AFTER DELETE ON public.feat_details
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.details",
      "columns": ["detail_id"]
    }]');
  END IF;
END;
$$;
