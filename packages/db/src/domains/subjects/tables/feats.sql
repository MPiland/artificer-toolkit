/* ──────────────────────────────────────────────
* FEATS — ROOT
*
* Intent:
*   A Feat is a top-level authored subject that grants
*   persistent capabilities, modifiers, and/or features.
*
* Cardinality:
*   systems 1 ──▶ N feats
*
* Ownership:
*   feats → charges (owned)
*   feats → restrictions (owned)
*   feats → effects (owned)
*   feats → modifier_grants (owned)
*   feats → proficiency_grants (owned)
*   feats → sense_grants (owned)
*   feats → spell_grants (owned)
*   feats → features (owned)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  label text NOT NULL,
  description text NOT NULL,
  detail text,
  charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  is_master boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT
  public.apply_system_derived_policies ('feats');

CREATE INDEX IF NOT EXISTS idx_feats_system ON public.feats (system_id);

CREATE INDEX IF NOT EXISTS idx_feats_user ON public.feats (user_id);

CREATE INDEX IF NOT EXISTS idx_feats_charge ON public.feats (charge_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feats_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feats_owned
    AFTER DELETE ON public.feats
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feats_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_feats_owned_on_update
    AFTER UPDATE ON public.feats
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEAT — TRAITS
*
* Intent:
*   Engine-core TraitCode[] applied to the feat.
*
* Ownership:
*   Fully owned by feats (authoritative array).
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_traits (
  feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  trait_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feat_id, trait_code)
);

ALTER TABLE feat_traits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_traits_feat ON public.feat_traits (feat_id);

/* ──────────────────────────────────────────────
* FEAT — EFFECTS (OWNED)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_effects (
  feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  effect_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feat_id, effect_id)
);

ALTER TABLE feat_effects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_effects_feat ON public.feat_effects (feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_effects_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_effects_owned
    AFTER DELETE ON public.feat_effects
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.effects", "columns": ["effect_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEAT — MODIFIER GRANTS
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_modifier_grants (
  feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  modifier_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feat_id, modifier_grant_id)
);

ALTER TABLE feat_modifier_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_modifier_grants_feat ON public.feat_modifier_grants (feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_modifier_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_modifier_grants_owned
    AFTER DELETE ON public.feat_modifier_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.modifier_grants", "columns": ["modifier_grant_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEAT — SPELL GRANTS
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_spell_grants (
  feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  spell_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feat_id, spell_grant_id)
);

ALTER TABLE feat_spell_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_spell_grants_feat ON public.feat_spell_grants (feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_spell_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_spell_grants_owned
    AFTER DELETE ON public.feat_spell_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.spell_grants", "columns": ["spell_grant_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEAT — SENSE GRANTS
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_sense_grants (
  feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sense_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feat_id, sense_grant_id)
);

ALTER TABLE feat_sense_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_sense_grants_feat ON public.feat_sense_grants (feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_sense_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_sense_grants_owned
    AFTER DELETE ON public.feat_sense_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.sense_grants", "columns": ["sense_grant_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEAT — PROFICIENCY GRANTS
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_proficiency_grants (
  feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  proficiency_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feat_id, proficiency_grant_id)
);

ALTER TABLE feat_proficiency_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_proficiency_grants_feat ON public.feat_proficiency_grants (feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_proficiency_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_proficiency_grants_owned
    AFTER DELETE ON public.feat_proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.proficiency_grants", "columns": ["proficiency_grant_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEAT — FEATURES (OWNED)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_features (
  feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  feature_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feat_id, feature_id)
);

ALTER TABLE feat_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_features_feat ON public.feat_features (feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_features_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_features_owned
    AFTER DELETE ON public.feat_features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.features", "columns": ["feature_id"] }
    ]');
  END IF;
END;
$$;
