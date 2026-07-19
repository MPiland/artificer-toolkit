ALTER TABLE public.proficiency_grant_save_abilities
  ADD COLUMN IF NOT EXISTS sort_order integer;

WITH ordered_abilities AS (
  SELECT
    proficiency_grant_id,
    ability_code,
    row_number() OVER (
      PARTITION BY proficiency_grant_id
      ORDER BY CASE ability_code
        WHEN 'STRENGTH' THEN 0
        WHEN 'DEXTERITY' THEN 1
        WHEN 'CONSTITUTION' THEN 2
        WHEN 'INTELLIGENCE' THEN 3
        WHEN 'WISDOM' THEN 4
        WHEN 'CHARISMA' THEN 5
        ELSE 6
      END,
      ability_code
    ) AS sort_order
  FROM public.proficiency_grant_save_abilities
)
UPDATE public.proficiency_grant_save_abilities AS save_ability
SET sort_order = ordered_ability.sort_order
FROM ordered_abilities AS ordered_ability
WHERE save_ability.proficiency_grant_id = ordered_ability.proficiency_grant_id
  AND save_ability.ability_code = ordered_ability.ability_code;

ALTER TABLE public.proficiency_grant_save_abilities
  ALTER COLUMN sort_order SET NOT NULL;

ALTER TABLE public.proficiency_grant_save_abilities
  DROP CONSTRAINT IF EXISTS proficiency_grant_save_abilities_sort_order_chk;

ALTER TABLE public.proficiency_grant_save_abilities
  ADD CONSTRAINT proficiency_grant_save_abilities_sort_order_chk
  CHECK (sort_order > 0);

ALTER TABLE public.proficiency_grant_save_abilities
  DROP CONSTRAINT IF EXISTS proficiency_grant_save_abilities_grant_order_uniq;

ALTER TABLE public.proficiency_grant_save_abilities
  ADD CONSTRAINT proficiency_grant_save_abilities_grant_order_uniq
  UNIQUE (proficiency_grant_id, sort_order);
