CREATE UNIQUE INDEX IF NOT EXISTS character_events_character_command_uniq
  ON public.character_events (character_id, command_id);
