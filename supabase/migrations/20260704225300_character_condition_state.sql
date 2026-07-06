CREATE TABLE IF NOT EXISTS public.character_conditions (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  condition_type_id uuid NOT NULL REFERENCES public.condition_types (id) ON DELETE CASCADE DEFERRABLE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, condition_type_id)
);

CREATE INDEX IF NOT EXISTS idx_character_conditions_condition_type_id
  ON public.character_conditions (condition_type_id);

ALTER TABLE IF EXISTS public.character_conditions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_exhaustion (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  level integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_exhaustion_level_chk CHECK (level >= 0 AND level <= 6)
);

ALTER TABLE IF EXISTS public.character_exhaustion ENABLE ROW LEVEL SECURITY;
