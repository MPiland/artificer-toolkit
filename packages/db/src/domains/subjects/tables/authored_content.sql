/* --------------------------------------------------
* AUTHORED DRAFTS AND IMPORT REFERENCES
*
* Normalized domain root tables are canonical active content. This table
* stores the one editable draft allowed for each authored root identity.
* -------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.authored_drafts (
  subject_kind text NOT NULL,
  subject_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  label text NOT NULL,
  payload jsonb NOT NULL,
  base_active_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_kind, subject_id),
  CONSTRAINT authored_drafts_kind_chk CHECK (
    subject_kind IN (
      'BACKGROUND',
      'CLASS',
      'CREATURE',
      'EQUIPMENT',
      'FEAT',
      'RACE',
      'SPELL',
      'VEHICLE'
    )
  ),
  CONSTRAINT authored_drafts_label_chk CHECK (length(btrim(label)) > 0),
  CONSTRAINT authored_drafts_payload_chk CHECK (jsonb_typeof(payload) = 'object')
);

ALTER TABLE public.authored_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own authored drafts" ON public.authored_drafts FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
    OR (
      (
        SELECT
          auth.jwt ()
      )::jsonb -> 'app_metadata' ->> 'admin'
    ) = 'true'
  );

CREATE POLICY "Users can insert own authored drafts" ON public.authored_drafts FOR INSERT TO authenticated
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
    OR (
      (
        SELECT
          auth.jwt ()
      )::jsonb -> 'app_metadata' ->> 'admin'
    ) = 'true'
  );

CREATE POLICY "Users can update own authored drafts" ON public.authored_drafts
FOR UPDATE
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
    OR (
      (
        SELECT
          auth.jwt ()
      )::jsonb -> 'app_metadata' ->> 'admin'
    ) = 'true'
  )
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
    OR (
      (
        SELECT
          auth.jwt ()
      )::jsonb -> 'app_metadata' ->> 'admin'
    ) = 'true'
  );

CREATE POLICY "Users can delete own authored drafts" ON public.authored_drafts FOR DELETE TO authenticated USING (
  user_id = (
    SELECT
      auth.uid ()
  )
  OR (
    (
      SELECT
        auth.jwt ()
    )::jsonb -> 'app_metadata' ->> 'admin'
  ) = 'true'
);

CREATE INDEX IF NOT EXISTS idx_authored_drafts_user_updated ON public.authored_drafts (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_authored_drafts_system ON public.authored_drafts (system_id);

CREATE TABLE IF NOT EXISTS public.authored_import_refs (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source text NOT NULL,
  subject_kind text NOT NULL,
  external_id text NOT NULL,
  subject_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, source, subject_kind, external_id),
  CONSTRAINT authored_import_refs_source_chk CHECK (
    source IN ('DND_BEYOND', 'FOUNDRY_DND5E', 'ARTIFICER_JSON')
  ),
  CONSTRAINT authored_import_refs_kind_chk CHECK (
    subject_kind IN (
      'BACKGROUND',
      'CHARACTER',
      'CLASS',
      'CREATURE',
      'EQUIPMENT',
      'FEAT',
      'RACE',
      'SPELL',
      'VEHICLE'
    )
  ),
  CONSTRAINT authored_import_refs_external_id_chk CHECK (length(btrim(external_id)) > 0)
);

ALTER TABLE public.authored_import_refs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own authored import references" ON public.authored_import_refs FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
    OR (
      (
        SELECT
          auth.jwt ()
      )::jsonb -> 'app_metadata' ->> 'admin'
    ) = 'true'
  );

CREATE POLICY "Users can insert own authored import references" ON public.authored_import_refs FOR INSERT TO authenticated
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
    OR (
      (
        SELECT
          auth.jwt ()
      )::jsonb -> 'app_metadata' ->> 'admin'
    ) = 'true'
  );

CREATE POLICY "Users can update own authored import references" ON public.authored_import_refs
FOR UPDATE
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
    OR (
      (
        SELECT
          auth.jwt ()
      )::jsonb -> 'app_metadata' ->> 'admin'
    ) = 'true'
  )
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
    OR (
      (
        SELECT
          auth.jwt ()
      )::jsonb -> 'app_metadata' ->> 'admin'
    ) = 'true'
  );

CREATE POLICY "Users can delete own authored import references" ON public.authored_import_refs FOR DELETE TO authenticated USING (
  user_id = (
    SELECT
      auth.uid ()
  )
  OR (
    (
      SELECT
        auth.jwt ()
    )::jsonb -> 'app_metadata' ->> 'admin'
  ) = 'true'
);

CREATE INDEX IF NOT EXISTS idx_authored_import_refs_subject ON public.authored_import_refs (user_id, subject_kind, subject_id);

CREATE TABLE IF NOT EXISTS public.authored_creation_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  minute_window_start timestamptz NOT NULL,
  minute_count smallint NOT NULL DEFAULT 0,
  hour_window_start timestamptz NOT NULL,
  hour_count smallint NOT NULL DEFAULT 0,
  CONSTRAINT authored_creation_rate_limits_minute_count_chk CHECK (minute_count BETWEEN 0 AND 25),
  CONSTRAINT authored_creation_rate_limits_hour_count_chk CHECK (hour_count BETWEEN 0 AND 100)
);

ALTER TABLE public.authored_creation_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.authored_creation_rate_limits
FROM
  anon,
  authenticated;

REVOKE ALL ON TABLE public.authored_drafts,
public.authored_import_refs
FROM
  anon,
  authenticated;
