/* ──────────────────────────────────────────────
 * SPELLS — ROOT
 *
 * Intent:
 *   Spell is a top-level authored subject that defines
 *   a castable magical effect with level, school,
 *   casting time, and owned effects.
 *
 * Cardinality:
 *   systems 1 ──▶ N spells
 *
 * Ownership:
 *   spells → spell_effects (owned)
 *
 * References:
 *   spells → magic_schools
 *   spells → classes (many-to-many)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.spells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL REFERENCES public.systems (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  content_source_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  label text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  level INTEGER NOT NULL,
  magic_school_id uuid NOT NULL REFERENCES public.magic_schools (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  casting_time_unit text NOT NULL, -- CastingTimeUnit
  casting_time_amount INTEGER NOT NULL,
  material_description text,
  is_master BOOLEAN,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spells_status_chk CHECK (status IN ('DRAFT', 'ACTIVE'))
);

ALTER TABLE public.spells
ADD CONSTRAINT spells_content_source_system_fk
  FOREIGN KEY (content_source_id, system_id) REFERENCES public.content_sources (
    id,
    game_system_id
  )
    ON DELETE RESTRICT;

SELECT public.apply_system_derived_policies('spells');

ALTER TABLE public.spells ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_spells_system ON public.spells (system_id);

CREATE INDEX IF NOT EXISTS idx_spells_user ON public.spells (user_id);

CREATE INDEX IF NOT EXISTS idx_spells_level ON public.spells (level);

CREATE INDEX IF NOT EXISTS idx_spells_school ON public.spells (magic_school_id);

CREATE TABLE IF NOT EXISTS public.spell_attributes (
  spell_id uuid NOT NULL REFERENCES public.spells (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  attribute_code text NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (spell_id, attribute_code)
);

CREATE INDEX IF NOT EXISTS idx_spell_attributes_spell ON public.spell_attributes (
  spell_id
);

ALTER TABLE public.spell_attributes ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * SPELL — CLASSES
 *
 * Intent:
 *   Declares which classes can cast this spell.
 *
 * Ownership:
 *   NOT owned. Classes are vocabulary-level entities.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.spell_classes (
  spell_id uuid NOT NULL REFERENCES public.spells (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  class_id uuid NOT NULL REFERENCES public.classes (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (spell_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_spell_classes_spell ON public.spell_classes (
  spell_id
);

CREATE INDEX IF NOT EXISTS idx_spell_classes_class ON public.spell_classes (
  class_id
);

ALTER TABLE public.spell_classes ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * SPELL — EFFECTS (OWNED)
 *
 * Intent:
 *   Associates authored effects to the spell.
 *   Effects may scale by SPELL_CAST_LEVEL.
 *
 * Ownership:
 *   spell_effects owns effect rows.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.spell_effects (
  spell_id uuid NOT NULL REFERENCES public.spells (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  effect_id uuid NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (spell_id, effect_id)
);

CREATE INDEX IF NOT EXISTS idx_spell_effects_spell ON public.spell_effects (
  spell_id
);

ALTER TABLE public.spell_effects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_spell_effects_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_spell_effects_owned
    AFTER DELETE ON public.spell_effects
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.effects", "columns": ["effect_id"] }
    ]');
  END IF;
END;
$$;
