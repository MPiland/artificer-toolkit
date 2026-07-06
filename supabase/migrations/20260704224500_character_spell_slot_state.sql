CREATE TABLE IF NOT EXISTS public.character_spell_slot_state (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  slot_key text NOT NULL,
  used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, slot_key),
  CONSTRAINT character_spell_slot_state_used_chk CHECK (used >= 0)
);

CREATE INDEX IF NOT EXISTS idx_character_spell_slot_state_character_id
  ON public.character_spell_slot_state (character_id);

ALTER TABLE IF EXISTS public.character_spell_slot_state ENABLE ROW LEVEL SECURITY;
