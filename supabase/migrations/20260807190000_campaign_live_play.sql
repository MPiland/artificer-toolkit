-- Campaign sessions are editable records; the Campaign clock is independent.
ALTER TABLE public.campaign_sessions
  ADD COLUMN IF NOT EXISTS session_number integer,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS time_zone text;

WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY campaign_id ORDER BY created_at, id)::integer AS number
  FROM public.campaign_sessions
)
UPDATE public.campaign_sessions AS session
SET session_number = numbered.number
FROM numbered
WHERE session.id = numbered.id AND session.session_number IS NULL;

ALTER TABLE public.campaign_sessions
  ALTER COLUMN session_number SET NOT NULL,
  ALTER COLUMN title DROP NOT NULL;
ALTER TABLE public.campaign_sessions
  DROP CONSTRAINT IF EXISTS campaign_sessions_status_check,
  DROP CONSTRAINT IF EXISTS campaign_sessions_lifecycle_dates_check;
ALTER TABLE public.campaign_sessions
  ADD CONSTRAINT campaign_sessions_status_check CHECK (status IN ('OPEN', 'FINISHED'));
UPDATE public.campaign_sessions SET status = 'FINISHED', finished_at = updated_at WHERE status IN ('LIVE', 'ENDED');
UPDATE public.campaign_sessions SET status = 'OPEN' WHERE status = 'PLANNED' OR status IS NULL;
ALTER TABLE public.campaign_sessions
  DROP COLUMN IF EXISTS started_at,
  DROP COLUMN IF EXISTS ended_at,
  DROP COLUMN IF EXISTS session_date;
ALTER TABLE public.campaign_sessions DROP CONSTRAINT IF EXISTS campaign_sessions_schedule_check;
ALTER TABLE public.campaign_sessions
  ADD CONSTRAINT campaign_sessions_schedule_check CHECK (
    (scheduled_start_at IS NULL AND scheduled_end_at IS NULL AND time_zone IS NULL)
    OR (scheduled_start_at IS NOT NULL AND scheduled_end_at IS NOT NULL AND time_zone IS NOT NULL AND scheduled_end_at > scheduled_start_at)
  );
CREATE UNIQUE INDEX IF NOT EXISTS campaign_sessions_campaign_number_idx ON public.campaign_sessions (campaign_id, session_number);
CREATE INDEX IF NOT EXISTS campaign_sessions_campaign_idx ON public.campaign_sessions (campaign_id, session_number DESC, scheduled_start_at DESC NULLS LAST);
DROP TRIGGER IF EXISTS campaign_sessions_lifecycle_guard ON public.campaign_sessions;

CREATE TABLE IF NOT EXISTS public.campaign_session_attendance (
  session_id uuid NOT NULL REFERENCES public.campaign_sessions (id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  present boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, character_id),
  FOREIGN KEY (campaign_id, character_id)
    REFERENCES public.campaign_character_assignments (campaign_id, character_id)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS campaign_session_attendance_campaign_idx ON public.campaign_session_attendance (campaign_id, session_id);
ALTER TABLE public.campaign_session_attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_session_attendance FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.campaign_session_rsvps (
  session_id uuid NOT NULL REFERENCES public.campaign_sessions (id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  response text NOT NULL CHECK (response IN ('YES', 'NO', 'MAYBE')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id),
  FOREIGN KEY (campaign_id, user_id)
    REFERENCES public.campaign_memberships (campaign_id, user_id)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS campaign_session_rsvps_campaign_session_idx ON public.campaign_session_rsvps (campaign_id, session_id);
ALTER TABLE public.campaign_session_rsvps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_session_rsvps FROM anon, authenticated;

ALTER TABLE public.campaign_session_note_sections
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'SHARED',
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'SHARED_NOTE';
ALTER TABLE public.campaign_session_note_sections
  DROP CONSTRAINT IF EXISTS campaign_session_note_sections_visibility_check,
  DROP CONSTRAINT IF EXISTS campaign_session_note_sections_kind_check,
  DROP CONSTRAINT IF EXISTS campaign_session_note_sections_kind_visibility_check;
ALTER TABLE public.campaign_session_note_sections
  ADD CONSTRAINT campaign_session_note_sections_visibility_check CHECK (visibility IN ('SHARED', 'GM_PRIVATE')),
  ADD CONSTRAINT campaign_session_note_sections_kind_check CHECK (kind IN ('SHARED_NOTE', 'AGENDA', 'SCENE', 'SECRET', 'REWARD', 'SCRATCHPAD', 'RECAP', 'ENDING_STATE', 'CANON', 'RULING', 'FOLLOW_UP')),
  ADD CONSTRAINT campaign_session_note_sections_kind_visibility_check CHECK ((kind = 'SHARED_NOTE' AND visibility = 'SHARED') OR (kind <> 'SHARED_NOTE' AND visibility = 'GM_PRIVATE'));

CREATE TABLE IF NOT EXISTS public.campaign_session_reference_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.campaign_sessions (id) ON DELETE CASCADE,
  target_kind text NOT NULL CHECK (target_kind IN ('CAMPAIGN_NOTE', 'AUTHORED_ROUTE')),
  note_section_id uuid REFERENCES public.campaign_note_sections (id) ON DELETE CASCADE,
  route_subject_kind text,
  route_public_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (target_kind = 'CAMPAIGN_NOTE' AND note_section_id IS NOT NULL AND route_subject_kind IS NULL AND route_public_id IS NULL)
    OR (target_kind = 'AUTHORED_ROUTE' AND note_section_id IS NULL AND route_subject_kind IS NOT NULL AND route_public_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS campaign_session_reference_pins_session_idx ON public.campaign_session_reference_pins (session_id, created_at);
ALTER TABLE public.campaign_session_reference_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_session_reference_pins FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.campaign_clocks (
  campaign_id uuid PRIMARY KEY REFERENCES public.campaigns (id) ON DELETE CASCADE,
  day integer NOT NULL CHECK (day >= 1),
  minute_of_day integer NOT NULL CHECK (minute_of_day BETWEEN 0 AND 1439),
  running boolean NOT NULL DEFAULT false,
  running_since timestamptz,
  dawn_minute integer NOT NULL DEFAULT 360 CHECK (dawn_minute BETWEEN 0 AND 1439),
  dusk_minute integer NOT NULL DEFAULT 1080 CHECK (dusk_minute BETWEEN 0 AND 1439),
  processed_boundary_absolute_minute bigint NOT NULL DEFAULT -1,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((running AND running_since IS NOT NULL) OR (NOT running AND running_since IS NULL))
);
ALTER TABLE public.campaign_clocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_clocks FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.campaign_live_play_commands (
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  command_id uuid NOT NULL,
  command_type text NOT NULL CHECK (char_length(btrim(command_type)) BETWEEN 1 AND 80),
  input_fingerprint text NOT NULL,
  result_payload jsonb NOT NULL CHECK (jsonb_typeof(result_payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, command_id)
);
ALTER TABLE public.campaign_live_play_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_live_play_commands FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.campaign_clock_recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  boundary_absolute_minute bigint NOT NULL,
  boundary_kind text NOT NULL CHECK (boundary_kind IN ('DAWN', 'DUSK', 'DAILY')),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  resource_key text NOT NULL CHECK (char_length(btrim(resource_key)) BETWEEN 1 AND 240),
  event_id uuid NOT NULL REFERENCES public.campaign_events (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, boundary_absolute_minute, character_id, resource_key)
);
ALTER TABLE public.campaign_clock_recoveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campaign_clock_recoveries FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS campaign_clock_recoveries_campaign_boundary_idx
  ON public.campaign_clock_recoveries (campaign_id, boundary_absolute_minute);
