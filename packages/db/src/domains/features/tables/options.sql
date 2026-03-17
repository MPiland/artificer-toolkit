/* ──────────────────────────────────────────────
* FEATURE OPTIONS — ROOT
*
* Intent:
*   A Feature Option is an authored feature-like container that can
*   carry attributes, restrictions, charges, effects, and grants.
*
*   This table represents the option itself; all child content is stored
*   in owned/authoritative child tables and bridge tables.
*
* Cardinality:
*   systems 1 ──▶ N options
*
* Ownership:
*   options → charges (1:1 owned via charge_id)
*   options → restrictions (owned via bridge)
*   options → effects (owned via bridge)
*   options → feat_grants (owned via bridge)
*   options → modifier_grants (owned via bridge)
*   options → proficiency_grants (owned via bridge)
*   options → sense_grants (owned via bridge)
*   options → spell_grants (owned via bridge)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  description text NOT NULL,
  detail text,
  sort_order integer NOT NULL,
  charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_options_charge ON public.options (charge_id);

ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_owned_on_update
    AFTER UPDATE ON public.options
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
    WHERE tgname = 'trg_cleanup_option_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_owned
    AFTER DELETE ON public.options
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.option_attributes (
  option_id uuid NOT NULL REFERENCES public.options (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  attribute_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (option_id, attribute_code)
);

CREATE INDEX IF NOT EXISTS idx_option_attributes_option ON public.option_attributes (option_id);

ALTER TABLE public.option_attributes ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
* FEATURE OPTION — EFFECTS (OWNED)
*
* Intent:
*   Associates authored effects to the option (ordered).
*
* Cardinality:
*   options 1 ──▶ N option_effects
*
* Ownership:
*   option_effects owns effects rows.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.option_effects (
  option_id uuid NOT NULL REFERENCES public.options (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  effect_id uuid NOT NULL REFERENCES public.effects (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,
  PRIMARY KEY (option_id, effect_id)
);

ALTER TABLE public.option_effects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_option_effects_option ON public.option_effects (option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_effects_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_effects_owned
    AFTER DELETE ON public.option_effects
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.effects", "columns": ["effect_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEATURE OPTION — GRANTS (OWNED BRIDGES)
*
* Intent:
*   Each grant kind is stored in its own grant table; these bridges
*   attach grants to the option (ordered).
*
* Cardinality:
*   options 1 ──▶ N <bridge>
*
* Ownership:
*   Each bridge owns its grant rows.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.option_feat_grants (
  option_id uuid NOT NULL REFERENCES public.options (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  feat_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (option_id, feat_grant_id)
);

ALTER TABLE public.option_feat_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_option_feat_grants_option ON public.option_feat_grants (option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_feat_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_feat_grants_owned
    AFTER DELETE ON public.option_feat_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.feat_grants", "columns": ["feat_grant_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.option_modifier_grants (
  option_id uuid NOT NULL REFERENCES public.options (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  modifier_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (option_id, modifier_grant_id)
);

ALTER TABLE public.option_modifier_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_option_modifier_grants_option ON public.option_modifier_grants (option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_modifier_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_modifier_grants_owned
    AFTER DELETE ON public.option_modifier_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.modifier_grants", "columns": ["modifier_grant_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.option_proficiency_grants (
  option_id uuid NOT NULL REFERENCES public.options (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  proficiency_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (option_id, proficiency_grant_id)
);

ALTER TABLE public.option_proficiency_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_option_proficiency_grants_option ON public.option_proficiency_grants (option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_proficiency_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_proficiency_grants_owned
    AFTER DELETE ON public.option_proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.proficiency_grants", "columns": ["proficiency_grant_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.option_sense_grants (
  option_id uuid NOT NULL REFERENCES public.options (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sense_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (option_id, sense_grant_id)
);

ALTER TABLE public.option_sense_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_option_sense_grants_option ON public.option_sense_grants (option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_sense_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_sense_grants_owned
    AFTER DELETE ON public.option_sense_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.sense_grants", "columns": ["sense_grant_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.option_spell_grants (
  option_id uuid NOT NULL REFERENCES public.options (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  spell_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (option_id, spell_grant_id)
);

ALTER TABLE public.option_spell_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_option_spell_grants_option ON public.option_spell_grants (option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_spell_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_spell_grants_owned
    AFTER DELETE ON public.option_spell_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.spell_grants", "columns": ["spell_grant_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* OWNED CHILD CLEANUP: options → charges
*
* Intent:
*   charge_id is an owned FK. When the feature option is deleted,
*   delete the owned charge row.
*
*   When charge_id changes (or is cleared), delete the old owned row.
* ────────────────────────────────────────────── */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_options_charge_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_options_charge_owned
    AFTER DELETE ON public.options
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_options_charge_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_options_charge_owned_on_update
    AFTER UPDATE OF charge_id ON public.options
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] }
    ]');
  END IF;
END;
$$;
