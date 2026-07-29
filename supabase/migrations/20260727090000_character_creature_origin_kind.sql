ALTER TABLE public.character_creatures
  ADD COLUMN IF NOT EXISTS origin_kind text;

ALTER TABLE public.character_creatures
  ADD COLUMN IF NOT EXISTS current_hit_points integer,
  ADD COLUMN IF NOT EXISTS temp_hit_points integer;

ALTER TABLE public.character_vehicles
  ADD COLUMN IF NOT EXISTS current_hit_points integer;

ALTER TABLE public.character_creatures
  DROP CONSTRAINT IF EXISTS character_creatures_hit_points_nonnegative_chk,
  ADD CONSTRAINT character_creatures_hit_points_nonnegative_chk CHECK (
    (current_hit_points IS NULL OR current_hit_points >= 0)
    AND (temp_hit_points IS NULL OR temp_hit_points >= 0)
  );

ALTER TABLE public.character_vehicles
  DROP CONSTRAINT IF EXISTS character_vehicles_current_hit_points_nonnegative_chk,
  ADD CONSTRAINT character_vehicles_current_hit_points_nonnegative_chk CHECK (
    current_hit_points IS NULL OR current_hit_points >= 0
  );

UPDATE public.character_creatures
SET origin_kind = CASE
  WHEN relationship_kind = 'SUMMONED' THEN 'SUMMONED'
  ELSE 'WORLD'
END
WHERE origin_kind IS NULL;

UPDATE public.character_creatures
SET relationship_kind = 'COMPANION'
WHERE relationship_kind = 'SUMMONED';

ALTER TABLE public.character_creatures
  ALTER COLUMN origin_kind SET DEFAULT 'WORLD',
  ALTER COLUMN origin_kind SET NOT NULL,
  DROP CONSTRAINT IF EXISTS character_creatures_relationship_kind_chk,
  DROP CONSTRAINT IF EXISTS character_creatures_origin_kind_chk,
  ADD CONSTRAINT character_creatures_relationship_kind_chk CHECK (
    relationship_kind IN ('MOUNT', 'COMPANION', 'OWNED')
  ),
  ADD CONSTRAINT character_creatures_origin_kind_chk CHECK (
    origin_kind IN ('WORLD', 'SUMMONED')
  );

CREATE TABLE IF NOT EXISTS public.character_creature_hit_dice_state (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  character_creature_id uuid NOT NULL,
  die integer NOT NULL,
  total integer NOT NULL,
  used integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, character_creature_id, die),
  CONSTRAINT character_creature_hit_dice_state_creature_owner_fkey
    FOREIGN KEY (character_id, character_creature_id)
    REFERENCES public.character_creatures (character_id, id)
    ON DELETE CASCADE DEFERRABLE,
  CONSTRAINT character_creature_hit_dice_state_values_chk CHECK (
    die > 0
    AND total >= 0
    AND used >= 0
    AND used <= total
  )
);

CREATE INDEX IF NOT EXISTS idx_character_creature_hit_dice_state_character_id
  ON public.character_creature_hit_dice_state (character_id, character_creature_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_character_creature_hit_dice_state_updated_at'
      AND tgrelid = 'public.character_creature_hit_dice_state'::regclass
  ) THEN
    CREATE TRIGGER trg_character_creature_hit_dice_state_updated_at
      BEFORE UPDATE ON public.character_creature_hit_dice_state
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at ( );
  END IF;
END;
$$;

ALTER TABLE public.character_creature_hit_dice_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct browser API access" ON public.character_creature_hit_dice_state;
CREATE POLICY "No direct browser API access"
  ON public.character_creature_hit_dice_state AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
