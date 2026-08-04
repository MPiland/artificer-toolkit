ALTER TABLE public.spell_grant_spells
  ADD COLUMN IF NOT EXISTS sort_order integer;

WITH ranked AS (
  SELECT
    spell_grant_id,
    spell_id,
    row_number() OVER (
      PARTITION BY spell_grant_id
      ORDER BY spell_id
    ) - 1 AS sort_order
  FROM public.spell_grant_spells
)
UPDATE public.spell_grant_spells AS grant_spell
SET sort_order = ranked.sort_order
FROM ranked
WHERE grant_spell.spell_grant_id = ranked.spell_grant_id
  AND grant_spell.spell_id = ranked.spell_id
  AND grant_spell.sort_order IS NULL;

ALTER TABLE public.spell_grant_spells
  ALTER COLUMN sort_order SET NOT NULL,
  ADD CONSTRAINT spell_grant_spells_sort_order_chk CHECK (sort_order >= 0),
  ADD CONSTRAINT spell_grant_spells_grant_sort_order_key UNIQUE (spell_grant_id, sort_order);

ALTER TABLE public.spell_grant_scaling_level_spells
  ADD COLUMN IF NOT EXISTS sort_order integer;

WITH ranked AS (
  SELECT
    scaling_level_id,
    spell_id,
    row_number() OVER (
      PARTITION BY scaling_level_id
      ORDER BY spell_id
    ) - 1 AS sort_order
  FROM public.spell_grant_scaling_level_spells
)
UPDATE public.spell_grant_scaling_level_spells AS level_spell
SET sort_order = ranked.sort_order
FROM ranked
WHERE level_spell.scaling_level_id = ranked.scaling_level_id
  AND level_spell.spell_id = ranked.spell_id
  AND level_spell.sort_order IS NULL;

ALTER TABLE public.spell_grant_scaling_level_spells
  ALTER COLUMN sort_order SET NOT NULL,
  ADD CONSTRAINT spell_grant_scaling_level_spells_sort_order_chk CHECK (sort_order >= 0),
  ADD CONSTRAINT spell_grant_scaling_level_spells_level_sort_order_key
    UNIQUE (scaling_level_id, sort_order);
