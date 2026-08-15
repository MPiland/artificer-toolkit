CREATE TABLE IF NOT EXISTS public.live_session_command_leases (
  session_id uuid PRIMARY KEY REFERENCES public.campaign_sessions (id) ON DELETE CASCADE,
  authority_id text NOT NULL CHECK (char_length(authority_id) BETWEEN 1 AND 128),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_session_command_leases_expiry_idx
  ON public.live_session_command_leases (expires_at);

ALTER TABLE public.live_session_command_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.live_session_command_leases FROM anon, authenticated;
