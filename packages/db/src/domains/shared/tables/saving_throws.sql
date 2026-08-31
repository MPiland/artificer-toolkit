/* ──────────────────────────────────────────────
 * SAVING THROWS — STANDALONE AUTHORED ENTITY
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.saving_throws (
  id uuid PRIMARY KEY,
  system_id uuid NOT NULL REFERENCES public.systems (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  dc_method text NOT NULL,
  ability_definition_id uuid NOT NULL,
  base_dc INTEGER,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saving_throws_dc_method_chk
    CHECK (dc_method IN ('SOURCE_SAVE_DC', 'FIXED_DC', 'DERIVED_DC')),
  CONSTRAINT saving_throws_payload_chk
    CHECK (
      (dc_method = 'SOURCE_SAVE_DC' AND base_dc IS NULL)
      OR (dc_method IN ('FIXED_DC', 'DERIVED_DC') AND base_dc IS NOT NULL)
    ),
  CONSTRAINT saving_throws_id_system_key UNIQUE (id, system_id),
  CONSTRAINT saving_throws_ability_definition_fkey
    FOREIGN KEY (
      ability_definition_id,
      system_id
    ) REFERENCES public.ability_definitions (id, system_id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.saving_throws ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_saving_throws_dc_method ON public.saving_throws (
  dc_method
);

CREATE INDEX IF NOT EXISTS idx_saving_throws_ability ON public.saving_throws (
  ability_definition_id
);

CREATE TABLE IF NOT EXISTS public.saving_throw_dc_bonuses (
  id uuid PRIMARY KEY,
  saving_throw_id uuid NOT NULL REFERENCES public.saving_throws (id)
    ON DELETE CASCADE,
  system_id uuid NOT NULL,
  sort_order INTEGER NOT NULL,
  bonus_kind text NOT NULL,
  ability_definition_id uuid,
  amount INTEGER,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saving_throw_dc_bonuses_kind_chk
    CHECK (
      bonus_kind IN ('ABILITY_MODIFIER', 'PROFICIENCY_BONUS', 'STATIC_BONUS')
    ),
  CONSTRAINT saving_throw_dc_bonuses_payload_chk
    CHECK (
      (
        bonus_kind = 'ABILITY_MODIFIER'
        AND ability_definition_id IS NOT NULL
        AND amount IS NULL
      )
      OR (
        bonus_kind = 'PROFICIENCY_BONUS'
        AND ability_definition_id IS NULL
        AND amount IS NULL
      )
      OR (
        bonus_kind = 'STATIC_BONUS'
        AND ability_definition_id IS NULL
        AND amount IS NOT NULL
      )
    ),
  CONSTRAINT saving_throw_dc_bonuses_parent_system_fkey
    FOREIGN KEY (saving_throw_id, system_id) REFERENCES public.saving_throws (
      id,
      system_id
    )
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT saving_throw_dc_bonuses_ability_definition_fkey
    FOREIGN KEY (
      ability_definition_id,
      system_id
    ) REFERENCES public.ability_definitions (id, system_id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.saving_throw_dc_bonuses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_saving_throw_dc_bonuses_saving_throw ON public.saving_throw_dc_bonuses (
  saving_throw_id,
  sort_order
);
