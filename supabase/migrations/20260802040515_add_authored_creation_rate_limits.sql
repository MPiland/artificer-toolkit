CREATE TABLE public.authored_definition_creation_rate_limits (
  user_id uuid PRIMARY KEY
    REFERENCES auth.users(id)
    ON DELETE CASCADE,
  minute_window_start timestamptz NOT NULL,
  minute_count smallint NOT NULL DEFAULT 0,
  hour_window_start timestamptz NOT NULL,
  hour_count smallint NOT NULL DEFAULT 0,

  CONSTRAINT authored_definition_creation_rate_limits_minute_count_chk CHECK (
    minute_count BETWEEN 0 AND 10
  ),
  CONSTRAINT authored_definition_creation_rate_limits_hour_count_chk CHECK (
    hour_count BETWEEN 0 AND 100
  )
);

ALTER TABLE public.authored_definition_creation_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.authored_definition_creation_rate_limits
  FROM anon, authenticated;
