ALTER TABLE public.creature_damage_resistances
  ADD COLUMN IF NOT EXISTS sort_order integer;

ALTER TABLE public.creature_damage_immunities
  ADD COLUMN IF NOT EXISTS sort_order integer;

ALTER TABLE public.creature_damage_vulnerabilities
  ADD COLUMN IF NOT EXISTS sort_order integer;

WITH ranked AS (
  SELECT
    creature_id,
    damage_type_id,
    row_number() OVER (
      PARTITION BY creature_id
      ORDER BY damage_type_id
    ) AS sort_order
  FROM public.creature_damage_resistances
)
UPDATE public.creature_damage_resistances AS resistance
SET sort_order = ranked.sort_order
FROM ranked
WHERE resistance.creature_id = ranked.creature_id
  AND resistance.damage_type_id = ranked.damage_type_id;

WITH ranked AS (
  SELECT
    creature_id,
    damage_type_id,
    row_number() OVER (
      PARTITION BY creature_id
      ORDER BY damage_type_id
    ) AS sort_order
  FROM public.creature_damage_immunities
)
UPDATE public.creature_damage_immunities AS immunity
SET sort_order = ranked.sort_order
FROM ranked
WHERE immunity.creature_id = ranked.creature_id
  AND immunity.damage_type_id = ranked.damage_type_id;

WITH ranked AS (
  SELECT
    creature_id,
    damage_type_id,
    row_number() OVER (
      PARTITION BY creature_id
      ORDER BY damage_type_id
    ) AS sort_order
  FROM public.creature_damage_vulnerabilities
)
UPDATE public.creature_damage_vulnerabilities AS vulnerability
SET sort_order = ranked.sort_order
FROM ranked
WHERE vulnerability.creature_id = ranked.creature_id
  AND vulnerability.damage_type_id = ranked.damage_type_id;

ALTER TABLE public.creature_damage_resistances
  DROP CONSTRAINT IF EXISTS creature_damage_resistances_creature_sort_order_key,
  DROP CONSTRAINT IF EXISTS creature_damage_resistances_sort_order_chk,
  ALTER COLUMN sort_order SET NOT NULL,
  ADD CONSTRAINT creature_damage_resistances_creature_sort_order_key
    UNIQUE (creature_id, sort_order),
  ADD CONSTRAINT creature_damage_resistances_sort_order_chk
    CHECK (sort_order > 0);

ALTER TABLE public.creature_damage_immunities
  DROP CONSTRAINT IF EXISTS creature_damage_immunities_creature_sort_order_key,
  DROP CONSTRAINT IF EXISTS creature_damage_immunities_sort_order_chk,
  ALTER COLUMN sort_order SET NOT NULL,
  ADD CONSTRAINT creature_damage_immunities_creature_sort_order_key
    UNIQUE (creature_id, sort_order),
  ADD CONSTRAINT creature_damage_immunities_sort_order_chk
    CHECK (sort_order > 0);

ALTER TABLE public.creature_damage_vulnerabilities
  DROP CONSTRAINT IF EXISTS creature_damage_vulnerabilities_creature_sort_order_key,
  DROP CONSTRAINT IF EXISTS creature_damage_vulnerabilities_sort_order_chk,
  ALTER COLUMN sort_order SET NOT NULL,
  ADD CONSTRAINT creature_damage_vulnerabilities_creature_sort_order_key
    UNIQUE (creature_id, sort_order),
  ADD CONSTRAINT creature_damage_vulnerabilities_sort_order_chk
    CHECK (sort_order > 0);
