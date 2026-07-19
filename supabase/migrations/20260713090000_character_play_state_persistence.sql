ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS inspiration boolean NOT NULL DEFAULT false,
  DROP COLUMN IF EXISTS build_state;

CREATE TABLE IF NOT EXISTS public.character_note_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  label text NOT NULL,
  sort_order integer NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_note_groups_kind_chk CHECK (
    kind IN ('SESSION', 'LOOT', 'CHARACTERS', 'PLACES', 'CUSTOM')
  ),
  CONSTRAINT character_note_groups_sort_order_chk CHECK (sort_order >= 0),
  CONSTRAINT character_note_groups_character_id_id_key UNIQUE (character_id, id)
);

CREATE INDEX IF NOT EXISTS idx_character_note_groups_character_id
  ON public.character_note_groups (character_id, sort_order);

ALTER TABLE public.character_note_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  group_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT character_notes_group_owner_fkey
    FOREIGN KEY (character_id, group_id)
    REFERENCES public.character_note_groups (character_id, id)
    ON DELETE CASCADE DEFERRABLE
);

CREATE INDEX IF NOT EXISTS idx_character_notes_character_id
  ON public.character_notes (character_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_character_notes_group_id
  ON public.character_notes (character_id, group_id);

ALTER TABLE public.character_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'character_equipment_container_id_fkey'
      AND conrelid = 'public.character_equipment'::regclass
  ) THEN
ALTER TABLE public.character_equipment
  ADD CONSTRAINT character_equipment_character_id_id_key UNIQUE (character_id, id),
  DROP CONSTRAINT character_equipment_container_id_fkey,
  ADD CONSTRAINT character_equipment_container_owner_fkey
    FOREIGN KEY (character_id, container_id)
    REFERENCES public.character_equipment (character_id, id)
    DEFERRABLE;

ALTER TABLE public.character_equipped
  DROP CONSTRAINT character_equipped_equipment_id_fkey,
  ADD CONSTRAINT character_equipped_equipment_owner_fkey
    FOREIGN KEY (character_id, equipment_id)
    REFERENCES public.character_equipment (character_id, id)
    ON DELETE CASCADE DEFERRABLE;

ALTER TABLE public.character_attuned
  DROP CONSTRAINT character_attuned_equipment_id_fkey,
  ADD CONSTRAINT character_attuned_equipment_owner_fkey
    FOREIGN KEY (character_id, equipment_id)
    REFERENCES public.character_equipment (character_id, id)
    ON DELETE CASCADE DEFERRABLE;

ALTER TABLE public.character_creatures
  ADD CONSTRAINT character_creatures_character_id_id_key UNIQUE (character_id, id);

ALTER TABLE public.character_vehicles
  ADD CONSTRAINT character_vehicles_character_id_id_key UNIQUE (character_id, id);

ALTER TABLE public.character_creature_equipment
  DROP CONSTRAINT character_creature_equipment_character_creature_id_fkey,
  DROP CONSTRAINT character_creature_equipment_equipment_id_fkey,
  ADD CONSTRAINT character_creature_equipment_creature_owner_fkey
    FOREIGN KEY (character_id, character_creature_id)
    REFERENCES public.character_creatures (character_id, id)
    ON DELETE CASCADE DEFERRABLE,
  ADD CONSTRAINT character_creature_equipment_item_owner_fkey
    FOREIGN KEY (character_id, equipment_id)
    REFERENCES public.character_equipment (character_id, id)
    ON DELETE CASCADE DEFERRABLE;

ALTER TABLE public.character_vehicle_equipment
  DROP CONSTRAINT character_vehicle_equipment_character_vehicle_id_fkey,
  DROP CONSTRAINT character_vehicle_equipment_equipment_id_fkey,
  ADD CONSTRAINT character_vehicle_equipment_vehicle_owner_fkey
    FOREIGN KEY (character_id, character_vehicle_id)
    REFERENCES public.character_vehicles (character_id, id)
    ON DELETE CASCADE DEFERRABLE,
  ADD CONSTRAINT character_vehicle_equipment_item_owner_fkey
    FOREIGN KEY (character_id, equipment_id)
    REFERENCES public.character_equipment (character_id, id)
    ON DELETE CASCADE DEFERRABLE;

ALTER TABLE public.character_currency_groups
  ADD CONSTRAINT character_currency_groups_character_id_id_key UNIQUE (character_id, id),
  DROP CONSTRAINT character_currency_groups_container_id_fkey,
  ADD CONSTRAINT character_currency_groups_container_owner_fkey
    FOREIGN KEY (character_id, container_id)
    REFERENCES public.character_equipment (character_id, id)
    DEFERRABLE;

ALTER TABLE public.character_currencies
  ADD COLUMN character_id uuid;

UPDATE public.character_currencies currency
SET character_id = currency_group.character_id
FROM public.character_currency_groups currency_group
WHERE currency_group.id = currency.group_id;

IF EXISTS (
  SELECT 1
  FROM public.character_currencies
  WHERE character_id IS NULL
) THEN
  RAISE EXCEPTION 'Cannot assign character ownership to every existing currency row.';
END IF;

ALTER TABLE public.character_currencies
  ALTER COLUMN character_id SET NOT NULL,
  ADD CONSTRAINT character_currencies_character_id_fkey
    FOREIGN KEY (character_id)
    REFERENCES public.characters (id)
    ON DELETE CASCADE DEFERRABLE,
  DROP CONSTRAINT character_currencies_group_id_fkey,
  DROP CONSTRAINT character_currencies_pkey,
  ADD CONSTRAINT character_currencies_pkey PRIMARY KEY (character_id, group_id, currency_id),
  ADD CONSTRAINT character_currencies_group_owner_fkey
    FOREIGN KEY (character_id, group_id)
    REFERENCES public.character_currency_groups (character_id, id)
    ON DELETE CASCADE DEFERRABLE;
  END IF;
END;
$$;
