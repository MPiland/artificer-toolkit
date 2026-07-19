/* ──────────────────────────────────────────────
* FEATURES — ROOT
*
* Intent:
*   A Feature is an authored container that groups
*   attributes, restrictions, effects, grants, and
*   selectable feature options.
*
*   Features may optionally expose Feature Options
*   gated by level via optionChoices.
*
* Cardinality:
*   systems 1 ──▶ N features
*
* Ownership:
*   features → attributes
*   features → restrictions (owned)
*   features → effects (owned)
*   features → <typed grant bridges>
*   features → feature_options (bridge)
*   features → feature_option_levels (owned)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  description text NOT NULL,
  section_code text,
  charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,
  available_at_level integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT features_section_code_chk CHECK (
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
  )
);

ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_owned_on_update
    AFTER UPDATE ON public.features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_owned
    AFTER DELETE ON public.features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.feature_details (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  detail_id uuid NOT NULL REFERENCES public.details (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, detail_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_details_feature ON public.feature_details (feature_id);

ALTER TABLE public.feature_details ENABLE ROW LEVEL SECURITY;

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

CREATE TABLE IF NOT EXISTS public.feature_attributes (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  attribute_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, attribute_code)
);

CREATE INDEX IF NOT EXISTS idx_feature_attributes_feature ON public.feature_attributes (feature_id);

ALTER TABLE public.feature_attributes ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
* FEATURE — EFFECTS (OWNED)
*
* Intent:
*   Associates authored effects to the feature.
*
* Ownership:
*   feature_effects owns effect rows.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feature_effects (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  effect_id uuid NOT NULL REFERENCES public.effects (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, effect_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_effects_feature ON public.feature_effects (feature_id);

ALTER TABLE public.feature_effects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_effects_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_effects_owned
    AFTER DELETE ON public.feature_effects
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.effects",
      "columns": ["effect_id"]
    }]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEATURE — GRANT BRIDGES (TYPED)
*
* Intent:
*   Each grant kind has its own authored table.
*   These bridges attach grants to the feature.
*
* Ownership:
*   Bridges own grant rows.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feature_feat_grants (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  feat_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, feat_grant_id)
);

ALTER TABLE public.feature_feat_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_feat_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_feat_grants_owned
    AFTER DELETE ON public.feature_feat_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.feat_grants",
      "columns": ["feat_grant_id"]
    }]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.feature_modifier_grants (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  modifier_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, modifier_grant_id)
);

ALTER TABLE public.feature_modifier_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_modifier_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_modifier_grants_owned
    AFTER DELETE ON public.feature_modifier_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.modifier_grants",
      "columns": ["modifier_grant_id"]
    }]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.feature_proficiency_grants (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  proficiency_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, proficiency_grant_id)
);

ALTER TABLE public.feature_proficiency_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_proficiency_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_proficiency_grants_owned
    AFTER DELETE ON public.feature_proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.proficiency_grants",
      "columns": ["proficiency_grant_id"]
    }]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.feature_sense_grants (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sense_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, sense_grant_id)
);

ALTER TABLE public.feature_sense_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_sense_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_sense_grants_owned
    AFTER DELETE ON public.feature_sense_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.sense_grants",
      "columns": ["sense_grant_id"]
    }]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.feature_spell_grants (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  spell_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, spell_grant_id)
);

ALTER TABLE public.feature_spell_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_spell_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_spell_grants_owned
    AFTER DELETE ON public.feature_spell_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.spell_grants",
      "columns": ["spell_grant_id"]
    }]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEATURE — OPTIONS (BRIDGE)
*
* Intent:
*   Attaches selectable Feature Options to the feature.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feature_options (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  option_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, option_id)
);

ALTER TABLE public.feature_options ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
* FEATURE — OPTIONS BY LEVEL (OWNED)
*
* Intent:
*   Defines how many options are selectable at
*   specific character levels.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feature_option_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  level integer NOT NULL,
  count integer NOT NULL,
  replace_count integer,
  sort_order integer NOT NULL
);

ALTER TABLE public.feature_option_levels ENABLE ROW LEVEL SECURITY;

