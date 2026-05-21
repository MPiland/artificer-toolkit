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

WITH source_rows AS (
  SELECT
    id AS feature_id,
    gen_random_uuid() AS detail_id,
    detail
  FROM public.features
  WHERE detail IS NOT NULL
    AND btrim(detail) <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM public.feature_details
      WHERE feature_details.feature_id = features.id
    )
),
inserted_details AS (
  INSERT INTO public.details (id, label, description, sort_order)
  SELECT detail_id, 'Detail', detail, 1
  FROM source_rows
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
INSERT INTO public.feature_details (feature_id, detail_id, sort_order)
SELECT source_rows.feature_id, source_rows.detail_id, 1
FROM source_rows
WHERE source_rows.detail_id IN (SELECT id FROM inserted_details)
ON CONFLICT (feature_id, detail_id) DO NOTHING;

WITH source_rows AS (
  SELECT
    id AS option_id,
    gen_random_uuid() AS detail_id,
    detail
  FROM public.options
  WHERE detail IS NOT NULL
    AND btrim(detail) <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM public.option_details
      WHERE option_details.option_id = options.id
    )
),
inserted_details AS (
  INSERT INTO public.details (id, label, description, sort_order)
  SELECT detail_id, 'Detail', detail, 1
  FROM source_rows
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
INSERT INTO public.option_details (option_id, detail_id, sort_order)
SELECT source_rows.option_id, source_rows.detail_id, 1
FROM source_rows
WHERE source_rows.detail_id IN (SELECT id FROM inserted_details)
ON CONFLICT (option_id, detail_id) DO NOTHING;

WITH source_rows AS (
  SELECT
    id AS feat_id,
    gen_random_uuid() AS detail_id,
    detail
  FROM public.feats
  WHERE detail IS NOT NULL
    AND btrim(detail) <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM public.feat_details
      WHERE feat_details.feat_id = feats.id
    )
),
inserted_details AS (
  INSERT INTO public.details (id, label, description, sort_order)
  SELECT detail_id, 'Detail', detail, 1
  FROM source_rows
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
INSERT INTO public.feat_details (feat_id, detail_id, sort_order)
SELECT source_rows.feat_id, source_rows.detail_id, 1
FROM source_rows
WHERE source_rows.detail_id IN (SELECT id FROM inserted_details)
ON CONFLICT (feat_id, detail_id) DO NOTHING;

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
