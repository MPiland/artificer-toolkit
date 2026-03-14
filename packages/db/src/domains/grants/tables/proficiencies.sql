/* ============================================================================
 * PROFICIENCY GRANTS
 *
 * Normalization notes:
 * - proficiency_grants stores the authored root metadata plus the single owned
 *   restriction subtree reference.
 * - payload surfaces stay explicit by proficiency kind instead of collapsing
 *   into generic value columns.
 * - equipment-related optional category/property filters are stored in their
 *   own small owned tables because they are not the same concept as granted
 *   equipment ids.
 * ========================================================================= */

CREATE TABLE IF NOT EXISTS public.proficiency_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_kind text NOT NULL DEFAULT 'PROFICIENCY_GRANT',
  sort_order integer NOT NULL,
  proficiency_kind text NOT NULL,
  selection_kind text NOT NULL,
  authoring_mode_kind text NOT NULL,
  count integer,
  level text NOT NULL,
  rounding text,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proficiency_grants_count_chk CHECK (
    (selection_kind <> 'CHOSEN' AND count IS NULL)
    OR (selection_kind = 'CHOSEN' AND count IS NOT NULL AND count > 0)
  ),
  CONSTRAINT proficiency_grants_rounding_chk CHECK (
    (level = 'HALF' AND rounding IS NOT NULL)
    OR (level <> 'HALF' AND rounding IS NULL)
  )
);

ALTER TABLE public.proficiency_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_proficiency_grants_kind ON public.proficiency_grants (proficiency_kind);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_proficiency_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_proficiency_grants_owned
    AFTER DELETE ON public.proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_proficiency_grants_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_proficiency_grants_owned_on_update
    AFTER UPDATE ON public.proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_traits (
  proficiency_grant_id uuid NOT NULL REFERENCES public.proficiency_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  trait_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (proficiency_grant_id, trait_code)
);

ALTER TABLE public.proficiency_grant_traits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_proficiency_grant_traits_grant ON public.proficiency_grant_traits (proficiency_grant_id);

CREATE TABLE IF NOT EXISTS public.proficiency_grant_skills (
  proficiency_grant_id uuid NOT NULL REFERENCES public.proficiency_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  skill_id uuid NOT NULL REFERENCES public.skills (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (proficiency_grant_id, skill_id)
);

ALTER TABLE public.proficiency_grant_skills ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_save_abilities (
  proficiency_grant_id uuid NOT NULL REFERENCES public.proficiency_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  ability_code text NOT NULL,
  PRIMARY KEY (proficiency_grant_id, ability_code)
);

ALTER TABLE public.proficiency_grant_save_abilities ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_languages (
  proficiency_grant_id uuid NOT NULL REFERENCES public.proficiency_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  language_id uuid NOT NULL REFERENCES public.languages (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (proficiency_grant_id, language_id)
);

ALTER TABLE public.proficiency_grant_languages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_equipment (
  proficiency_grant_id uuid NOT NULL REFERENCES public.proficiency_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  equipment_id uuid NOT NULL,
  PRIMARY KEY (proficiency_grant_id, equipment_id)
);

ALTER TABLE public.proficiency_grant_equipment ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_equipment_filters (
  proficiency_grant_id uuid PRIMARY KEY REFERENCES public.proficiency_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  category_code text
);

ALTER TABLE public.proficiency_grant_equipment_filters ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_equipment_filter_properties (
  proficiency_grant_id uuid NOT NULL REFERENCES public.proficiency_grant_equipment_filters (proficiency_grant_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  property_code text NOT NULL,
  PRIMARY KEY (proficiency_grant_id, property_code)
);

ALTER TABLE public.proficiency_grant_equipment_filter_properties ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_equipment_properties (
  proficiency_grant_id uuid NOT NULL REFERENCES public.proficiency_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  property_code text NOT NULL,
  PRIMARY KEY (proficiency_grant_id, property_code)
);

ALTER TABLE public.proficiency_grant_equipment_properties ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_equipment_property_filters (
  proficiency_grant_id uuid PRIMARY KEY REFERENCES public.proficiency_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  category_code text
);

ALTER TABLE public.proficiency_grant_equipment_property_filters ENABLE ROW LEVEL SECURITY;
