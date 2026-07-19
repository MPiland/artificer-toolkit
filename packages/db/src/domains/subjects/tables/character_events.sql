/* ──────────────────────────────────────────────
 * CHARACTER_EVENTS
 *
 * Immutable event log for character lifecycle.
 * Events are append-only — never updated or deleted except via cascade.
 * ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.character_events (
  event_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id   uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE DEFERRABLE,
  event_type     text NOT NULL,
  event_data     jsonb NOT NULL,
  schema_version int NOT NULL DEFAULT 1,
  actor_id       uuid NOT NULL,
  command_id     uuid NOT NULL,
  occurred_at    timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_events_character_command_uniq UNIQUE (character_id, command_id)
);

ALTER TABLE public.character_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_character_events_character_id
  ON public.character_events (character_id, occurred_at);
