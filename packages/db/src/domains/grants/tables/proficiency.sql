/* ──────────────────────────────────────────────
 * PROFICIENCY GRANTS — ROOT
 *
 * Intent:
 *   Grants proficiency to a character. Proficiencies
 *   may be skills, saving throws, languages, equipment,
 *   or equipment properties.
 *
 *   Scaling modifies proficiency amount:
 *     HALF | FULL | DOUBLE (+ rounding)
 *
 * Cardinality:
 *   systems 1 ──▶ N proficiency_grants
 *
 * Ownership:
 *   proficiency_grants → traits
 *   proficiency_grants → restrictions
 *   proficiency_grants → filters (equipment only)
 *   proficiency_grants → payload rows
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.proficiency_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  sort_order integer NOT NULL,

  proficiency_kind text NOT NULL,     -- ProficiencyTypeCode
  selection_kind text NOT NULL,       -- GRANTED | CHOSEN
  authoring_mode_kind text NOT NULL,         -- ALL | SELECTED

  selection_count integer,            -- CHOSEN only

  scaling_level text NOT NULL,        -- HALF | FULL | DOUBLE
  rounding text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proficiency_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_proficiency_grants_type
  ON public.proficiency_grants(proficiency_kind);

  /* ──────────────────────────────────────────────
 * PROFICIENCY GRANT — TARGETS (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.proficiency_grant_target_groups (
  proficiency_grant_id uuid NOT NULL
    REFERENCES public.proficiency_grants(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  target_group_id uuid NOT NULL
    REFERENCES public.target_groups(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  PRIMARY KEY (proficiency_grant_id, target_group_id)
);

ALTER TABLE public.proficiency_grant_target_groups ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_proficiency_grant_target_groups_proficiency_grant
  ON public.proficiency_grant_target_groups(proficiency_grant_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_proficiency_grant_target_groups_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_proficiency_grant_target_groups_owned
    AFTER DELETE ON public.proficiency_grant_target_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.target_groups", "columns": ["target_group_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * PROFICIENCY GRANT — TRAITS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.proficiency_grant_traits (
  proficiency_grant_id uuid NOT NULL
    REFERENCES public.proficiency_grants(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  trait_code text NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (proficiency_grant_id, trait_code)
);

ALTER TABLE public.proficiency_grant_traits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_proficiency_grant_traits_grant
  ON public.proficiency_grant_traits(proficiency_grant_id);

/* ──────────────────────────────────────────────
 * PROFICIENCY GRANT — PAYLOADS
 * One table per payload surface for clarity
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.proficiency_grant_skills (
  proficiency_grant_id uuid NOT NULL
    REFERENCES public.proficiency_grants(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  skillId uuid NOT NULL
    REFERENCES public.skills(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (proficiency_grant_id, skillId)
);

ALTER TABLE public.proficiency_grant_skills ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_save_abilities (
  proficiency_grant_id uuid NOT NULL
    REFERENCES public.proficiency_grants(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  ability_code text NOT NULL,

  PRIMARY KEY (proficiency_grant_id, ability_code)
);

ALTER TABLE public.proficiency_grant_save_abilities ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_languages (
  proficiency_grant_id uuid NOT NULL
    REFERENCES public.proficiency_grants(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  language_id uuid NOT NULL
    REFERENCES public.languages(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (proficiency_grant_id, language_id)
);

ALTER TABLE public.proficiency_grant_languages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_equipment (
  proficiency_grant_id uuid NOT NULL
    REFERENCES public.proficiency_grants(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  equipment_id uuid NOT NULL
    REFERENCES public.equipment(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (proficiency_grant_id, equipment_id)
);

ALTER TABLE public.proficiency_grant_equipment ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_equipment_properties (
  proficiency_grant_id uuid NOT NULL
    REFERENCES public.proficiency_grants(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  property_code text NOT NULL,

  PRIMARY KEY (proficiency_grant_id, property_code)
);

ALTER TABLE public.proficiency_grant_equipment_properties ENABLE ROW LEVEL SECURITY;