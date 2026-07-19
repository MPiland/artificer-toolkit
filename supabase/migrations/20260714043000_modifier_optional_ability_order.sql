ALTER TABLE public.modifier_grant_optional_abilities
  ADD COLUMN IF NOT EXISTS sort_order integer;

WITH ranked AS (
  SELECT
    modifier_grant_id,
    ability_code,
    row_number() OVER (
      PARTITION BY modifier_grant_id
      ORDER BY ability_code
    ) AS sort_order
  FROM public.modifier_grant_optional_abilities
)
UPDATE public.modifier_grant_optional_abilities AS optional_ability
SET sort_order = ranked.sort_order
FROM ranked
WHERE optional_ability.modifier_grant_id = ranked.modifier_grant_id
  AND optional_ability.ability_code = ranked.ability_code;

ALTER TABLE public.modifier_grant_optional_abilities
  ALTER COLUMN sort_order SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.modifier_grant_optional_abilities'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (modifier_grant_id, sort_order)'
  ) THEN
    ALTER TABLE public.modifier_grant_optional_abilities
      ADD CONSTRAINT modifier_grant_optional_abilities_grant_sort_order_key
      UNIQUE (modifier_grant_id, sort_order);
  END IF;
END;
$$;
