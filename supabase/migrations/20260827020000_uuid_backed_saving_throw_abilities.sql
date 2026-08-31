-- Gate 2: authored Effect saving throws reference System-owned ability UUIDs.
-- Legacy code values are accepted only for the canonical D&D System migration.

CREATE TABLE IF NOT EXISTS public.ability_definitions (
  id uuid PRIMARY KEY,
  system_id uuid NOT NULL REFERENCES public.systems (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, system_id),
  UNIQUE (system_id, code)
);

ALTER TABLE public.ability_definitions ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('ability_definitions');
CREATE INDEX IF NOT EXISTS idx_ability_definitions_system ON public.ability_definitions (
  system_id
);

-- A clean reset reaches this migration before command-driven source seeding. Only
-- legacy rows require the canonical D&D vocabulary; never fabricate that System.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.saving_throws) THEN
    IF NOT EXISTS (SELECT 1 FROM public.systems WHERE id = '00000000-0000-0000-0000-000000000001') THEN
      RAISE EXCEPTION 'Cannot migrate saving throw abilities: canonical D&D System is missing.';
    END IF;

    INSERT INTO public.ability_definitions (id, system_id, code, label)
    VALUES
      ('00000000-0000-0000-0011-000100000000', '00000000-0000-0000-0000-000000000001', 'STRENGTH', 'Strength'),
      ('00000000-0000-0000-0011-000200000000', '00000000-0000-0000-0000-000000000001', 'DEXTERITY', 'Dexterity'),
      ('00000000-0000-0000-0011-000300000000', '00000000-0000-0000-0000-000000000001', 'CONSTITUTION', 'Constitution'),
      ('00000000-0000-0000-0011-000400000000', '00000000-0000-0000-0000-000000000001', 'INTELLIGENCE', 'Intelligence'),
      ('00000000-0000-0000-0011-000500000000', '00000000-0000-0000-0000-000000000001', 'WISDOM', 'Wisdom'),
      ('00000000-0000-0000-0011-000600000000', '00000000-0000-0000-0000-000000000001', 'CHARISMA', 'Charisma')
    ON CONFLICT (id) DO UPDATE
    SET
      code = EXCLUDED.code,
      label = EXCLUDED.label
    WHERE public.ability_definitions.system_id = EXCLUDED.system_id;

    IF (
      SELECT count(*)
      FROM public.ability_definitions
      WHERE id IN (
        '00000000-0000-0000-0011-000100000000'::uuid,
        '00000000-0000-0000-0011-000200000000'::uuid,
        '00000000-0000-0000-0011-000300000000'::uuid,
        '00000000-0000-0000-0011-000400000000'::uuid,
        '00000000-0000-0000-0011-000500000000'::uuid,
        '00000000-0000-0000-0011-000600000000'::uuid
      )
        AND system_id = '00000000-0000-0000-0000-000000000001'::uuid
    ) <> 6 THEN
      RAISE EXCEPTION 'Cannot migrate saving throw abilities: canonical ability UUID is owned by another System.';
    END IF;
  END IF;
END;
$$;

ALTER TABLE public.saving_throws
ADD COLUMN IF NOT EXISTS system_id uuid,
ADD COLUMN IF NOT EXISTS ability_definition_id uuid;

ALTER TABLE public.saving_throw_dc_bonuses
ADD COLUMN IF NOT EXISTS system_id uuid,
ADD COLUMN IF NOT EXISTS ability_definition_id uuid;

CREATE TEMPORARY TABLE saving_throw_system_candidates
ON COMMIT DROP
AS
  WITH
    feature_systems AS (
      SELECT link.feature_id, subject.system_id
      FROM
        public.creature_features AS link
        JOIN public.creatures AS subject ON subject.id = link.creature_id
      UNION
      SELECT link.feature_id, subject.system_id
      FROM
        public.class_features AS link
        JOIN public.classes AS subject ON subject.id = link.class_id
      UNION
      SELECT link.feature_id, subject.system_id
      FROM
        public.background_features AS link
        JOIN public.backgrounds AS subject ON subject.id = link.background_id
      UNION
      SELECT link.feature_id, subject.system_id
      FROM
        public.feat_features AS link
        JOIN public.feats AS subject ON subject.id = link.feat_id
      UNION
      SELECT link.feature_id, subject.system_id
      FROM
        public.race_features AS link
        JOIN public.races AS subject ON subject.id = link.race_id
      UNION
      SELECT link.feature_id, subject.system_id
      FROM
        public.race_ancestry_option_features AS link
        JOIN public.race_ancestry_options AS ancestry_option
          ON ancestry_option.id = link.ancestry_option_id
        JOIN public.race_ancestries AS ancestry
          ON ancestry.id = ancestry_option.ancestry_id
        JOIN public.races AS subject ON subject.id = ancestry.race_id
      UNION
      SELECT link.feature_id, subject.system_id
      FROM
        public.vehicle_features AS link
        JOIN public.vehicles AS subject ON subject.id = link.vehicle_id
      UNION
      SELECT link.feature_id, subject.system_id
      FROM
        public.equipment_features AS link
        JOIN public.equipment AS subject ON subject.id = link.equipment_id
    ),
    effect_systems AS (
      SELECT link.effect_id, subject.system_id
      FROM
        public.spell_effects AS link
        JOIN public.spells AS subject ON subject.id = link.spell_id
      UNION
      SELECT link.effect_id, subject.system_id
      FROM
        public.feat_effects AS link
        JOIN public.feats AS subject ON subject.id = link.feat_id
      UNION
      SELECT link.effect_id, subject.system_id
      FROM
        public.equipment_effects AS link
        JOIN public.equipment AS subject ON subject.id = link.equipment_id
      UNION
      SELECT link.effect_id, owner.system_id
      FROM
        public.feature_effects AS link
        JOIN feature_systems AS owner ON owner.feature_id = link.feature_id
      UNION
      SELECT link.effect_id, owner.system_id
      FROM
        public.option_effects AS link
        JOIN public.feature_options AS option_link
          ON option_link.option_id = link.option_id
        JOIN feature_systems AS owner
          ON owner.feature_id = option_link.feature_id
    )
  SELECT
    saving_throw.id AS saving_throw_id,
    array_agg(DISTINCT effect_systems.system_id) FILTER (
      WHERE effect_systems.system_id IS NOT NULL
    ) AS system_ids
  FROM
    public.saving_throws AS saving_throw
    LEFT JOIN public.effect_invocations AS invocation
      ON invocation.saving_throw_id = saving_throw.id
    LEFT JOIN effect_systems ON effect_systems.effect_id = invocation.effect_id
  GROUP BY saving_throw.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.saving_throws saving_throw
    LEFT JOIN saving_throw_system_candidates candidates ON candidates.saving_throw_id = saving_throw.id
    WHERE candidates.system_ids IS NULL
      OR cardinality(candidates.system_ids) <> 1
      OR candidates.system_ids[1] <> '00000000-0000-0000-0000-000000000001'::uuid
  ) THEN
    RAISE EXCEPTION 'Cannot migrate saving throws without one exact canonical D&D System owner.';
  END IF;
END;
$$;

UPDATE public.saving_throws AS saving_throw
SET system_id = candidates.system_ids[1]
FROM saving_throw_system_candidates AS candidates
WHERE candidates.saving_throw_id = saving_throw.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.saving_throws
    WHERE ability_code NOT IN ('STRENGTH', 'DEXTERITY', 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM', 'CHARISMA')
  ) THEN
    RAISE EXCEPTION 'Cannot migrate saving throw with an unknown legacy ability code.';
  END IF;
END;
$$;

UPDATE public.saving_throws
SET ability_definition_id = CASE ability_code
  WHEN 'STRENGTH' THEN '00000000-0000-0000-0011-000100000000'::uuid
  WHEN 'DEXTERITY' THEN '00000000-0000-0000-0011-000200000000'::uuid
  WHEN 'CONSTITUTION' THEN '00000000-0000-0000-0011-000300000000'::uuid
  WHEN 'INTELLIGENCE' THEN '00000000-0000-0000-0011-000400000000'::uuid
  WHEN 'WISDOM' THEN '00000000-0000-0000-0011-000500000000'::uuid
  WHEN 'CHARISMA' THEN '00000000-0000-0000-0011-000600000000'::uuid
END;

UPDATE public.saving_throw_dc_bonuses AS bonus
SET system_id = saving_throw.system_id
FROM public.saving_throws AS saving_throw
WHERE saving_throw.id = bonus.saving_throw_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.saving_throw_dc_bonuses
    WHERE bonus_kind = 'ABILITY_MODIFIER'
      AND ability_code NOT IN ('STRENGTH', 'DEXTERITY', 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM', 'CHARISMA')
  ) THEN
    RAISE EXCEPTION 'Cannot migrate saving throw DC bonus with an unknown legacy ability code.';
  END IF;
END;
$$;

UPDATE public.saving_throw_dc_bonuses
SET ability_definition_id = CASE ability_code
  WHEN 'STRENGTH' THEN '00000000-0000-0000-0011-000100000000'::uuid
  WHEN 'DEXTERITY' THEN '00000000-0000-0000-0011-000200000000'::uuid
  WHEN 'CONSTITUTION' THEN '00000000-0000-0000-0011-000300000000'::uuid
  WHEN 'INTELLIGENCE' THEN '00000000-0000-0000-0011-000400000000'::uuid
  WHEN 'WISDOM' THEN '00000000-0000-0000-0011-000500000000'::uuid
  WHEN 'CHARISMA' THEN '00000000-0000-0000-0011-000600000000'::uuid
END
WHERE bonus_kind = 'ABILITY_MODIFIER';

ALTER TABLE public.saving_throws
ALTER COLUMN system_id SET NOT NULL,
ALTER COLUMN ability_definition_id SET NOT NULL,
DROP COLUMN ability_code,
ADD CONSTRAINT saving_throws_id_system_key UNIQUE (id, system_id),
ADD CONSTRAINT saving_throws_system_fkey
  FOREIGN KEY (system_id) REFERENCES public.systems (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT saving_throws_ability_definition_fkey
  FOREIGN KEY (
    ability_definition_id,
    system_id
  ) REFERENCES public.ability_definitions (id, system_id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.saving_throw_dc_bonuses
ALTER COLUMN system_id SET NOT NULL,
DROP CONSTRAINT IF EXISTS saving_throw_dc_bonuses_payload_chk,
DROP COLUMN ability_code,
ADD CONSTRAINT saving_throw_dc_bonuses_payload_chk
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
ADD CONSTRAINT saving_throw_dc_bonuses_parent_system_fkey
  FOREIGN KEY (saving_throw_id, system_id) REFERENCES public.saving_throws (
    id,
    system_id
  )
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT saving_throw_dc_bonuses_ability_definition_fkey
  FOREIGN KEY (
    ability_definition_id,
    system_id
  ) REFERENCES public.ability_definitions (id, system_id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS idx_saving_throws_ability_definition ON public.saving_throws (
  ability_definition_id
);
