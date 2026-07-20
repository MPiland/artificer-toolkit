ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS requires_attunement boolean;

UPDATE public.equipment
SET requires_attunement = false
WHERE requires_attunement IS NULL;

ALTER TABLE public.equipment
  ALTER COLUMN requires_attunement SET DEFAULT false,
  ALTER COLUMN requires_attunement SET NOT NULL;

ALTER TABLE public.features
  ADD COLUMN IF NOT EXISTS section_code text;

ALTER TABLE public.features
  DROP CONSTRAINT IF EXISTS features_section_code_chk,
  ADD CONSTRAINT features_section_code_chk CHECK (
    section_code IS NULL OR section_code IN (
      'TRAIT',
      'ACTION',
      'BONUS_ACTION',
      'REACTION',
      'LEGENDARY_ACTION',
      'LAIR_ACTION',
      'REGIONAL_EFFECT',
      'OTHER'
    )
  );

ALTER TABLE public.saving_throws
  DROP CONSTRAINT IF EXISTS saving_throws_kind_chk,
  DROP CONSTRAINT IF EXISTS saving_throws_dc_method_chk,
  DROP CONSTRAINT IF EXISTS saving_throws_payload_chk;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saving_throws'
      AND column_name = 'saving_throw_kind'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saving_throws'
      AND column_name = 'dc_method'
  ) THEN
    ALTER TABLE public.saving_throws
      RENAME COLUMN saving_throw_kind TO dc_method;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saving_throws'
      AND column_name = 'dc'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saving_throws'
      AND column_name = 'base_dc'
  ) THEN
    ALTER TABLE public.saving_throws
      RENAME COLUMN dc TO base_dc;
  END IF;
END;
$$;

ALTER TABLE public.saving_throws
  ADD COLUMN IF NOT EXISTS dc_method text,
  ADD COLUMN IF NOT EXISTS base_dc integer;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saving_throws'
      AND column_name = 'saving_throw_kind'
  ) THEN
    EXECUTE $sql$
      UPDATE public.saving_throws
      SET dc_method = CASE saving_throw_kind
        WHEN 'SOURCE_SAVE_DC' THEN 'SOURCE_SAVE_DC'
        WHEN 'FIXED_VALUE' THEN 'FIXED_DC'
        ELSE dc_method
      END
      WHERE dc_method IS NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saving_throws'
      AND column_name = 'dc'
  ) THEN
    EXECUTE $sql$
      UPDATE public.saving_throws
      SET base_dc = dc
      WHERE base_dc IS NULL
    $sql$;
  END IF;
END;
$$;

UPDATE public.saving_throws
SET dc_method = 'FIXED_DC'
WHERE dc_method = 'FIXED_VALUE';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.saving_throws
    WHERE dc_method IS NULL
      OR ability_code IS NULL
      OR dc_method NOT IN ('SOURCE_SAVE_DC', 'FIXED_DC', 'DERIVED_DC')
      OR (dc_method = 'SOURCE_SAVE_DC' AND base_dc IS NOT NULL)
      OR (dc_method IN ('FIXED_DC', 'DERIVED_DC') AND base_dc IS NULL)
  ) THEN
    RAISE EXCEPTION 'Existing saving throws cannot be converted to the current DC method schema.';
  END IF;
END;
$$;

ALTER TABLE public.saving_throws
  ALTER COLUMN dc_method SET NOT NULL,
  ALTER COLUMN ability_code SET NOT NULL;

ALTER TABLE public.saving_throws
  DROP COLUMN IF EXISTS saving_throw_kind,
  DROP COLUMN IF EXISTS dc;

ALTER TABLE public.saving_throws
  ADD CONSTRAINT saving_throws_dc_method_chk CHECK (
    dc_method IN ('SOURCE_SAVE_DC', 'FIXED_DC', 'DERIVED_DC')
  ),
  ADD CONSTRAINT saving_throws_payload_chk CHECK (
    (dc_method = 'SOURCE_SAVE_DC' AND base_dc IS NULL)
    OR (dc_method IN ('FIXED_DC', 'DERIVED_DC') AND base_dc IS NOT NULL)
  );

DROP INDEX IF EXISTS public.idx_saving_throws_kind;

CREATE INDEX IF NOT EXISTS idx_saving_throws_dc_method
  ON public.saving_throws (dc_method);

CREATE TABLE IF NOT EXISTS public.facet_predicate_class_items (
  facet_condition_id uuid NOT NULL,
  class_id uuid NOT NULL,
  sort_order integer NOT NULL,

  CONSTRAINT facet_predicate_class_items_pkey
    PRIMARY KEY (facet_condition_id, class_id),
  CONSTRAINT facet_predicate_class_items_facet_condition_id_fkey
    FOREIGN KEY (facet_condition_id)
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT facet_predicate_class_items_class_id_fkey
    FOREIGN KEY (class_id)
    REFERENCES public.classes (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.facet_predicate_class_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_class_items_condition
  ON public.facet_predicate_class_items (facet_condition_id);

CREATE TABLE IF NOT EXISTS public.feat_feat_grants (
  feat_id uuid NOT NULL,
  feat_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,

  CONSTRAINT feat_feat_grants_pkey
    PRIMARY KEY (feat_id, feat_grant_id),
  CONSTRAINT feat_feat_grants_feat_id_fkey
    FOREIGN KEY (feat_id)
    REFERENCES public.feats (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT feat_feat_grants_feat_grant_id_fkey
    FOREIGN KEY (feat_grant_id)
    REFERENCES public.feat_grants (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.feat_feat_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_feat_grants_feat
  ON public.feat_feat_grants (feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_feat_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_feat_grants_owned
    AFTER DELETE ON public.feat_feat_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.feat_grants", "columns": ["feat_grant_id"] }
    ]');
  END IF;
END;
$$;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.facet_predicate_class_items, public.feat_feat_grants
  FROM anon, authenticated;

DROP POLICY IF EXISTS "No direct browser API access"
  ON public.facet_predicate_class_items;
CREATE POLICY "No direct browser API access"
  ON public.facet_predicate_class_items
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "No direct browser API access"
  ON public.feat_feat_grants;
CREATE POLICY "No direct browser API access"
  ON public.feat_feat_grants
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
