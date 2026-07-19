-- Forward-compatible installation for environments that already recorded the
-- bootstrap migration before canonical authored revisions were introduced.
CREATE TABLE IF NOT EXISTS public.authored_definitions (
  subject_id uuid PRIMARY KEY,
  subject_kind text NOT NULL,
  owner_user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  label text NOT NULL,
  is_master boolean NOT NULL DEFAULT false,
  active_revision_id uuid,
  draft_revision_id uuid,
  next_revision_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT authored_definitions_kind_chk CHECK (
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
  CONSTRAINT authored_definitions_owner_chk CHECK (
    (
      is_master
      AND owner_user_id IS NULL
    )
    OR (
      NOT is_master
      AND owner_user_id IS NOT NULL
    )
  ),
  CONSTRAINT authored_definitions_revision_number_chk CHECK (next_revision_number > 0),
  CONSTRAINT authored_definitions_subject_kind_unique UNIQUE (subject_id, subject_kind)
);

CREATE TABLE IF NOT EXISTS public.authored_definition_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL REFERENCES public.authored_definitions (subject_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  revision_number integer NOT NULL,
  payload jsonb NOT NULL,
  base_active_revision_id uuid,
  created_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT authored_definition_revisions_number_chk CHECK (revision_number > 0),
  CONSTRAINT authored_definition_revisions_definition_number_unique UNIQUE (definition_id, revision_number),
  CONSTRAINT authored_definition_revisions_definition_id_unique UNIQUE (definition_id, id),
  CONSTRAINT authored_definition_revisions_base_revision_fk FOREIGN KEY (definition_id, base_active_revision_id) REFERENCES public.authored_definition_revisions (definition_id, id) DEFERRABLE INITIALLY DEFERRED
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'authored_definitions_active_revision_fk'
      AND conrelid = 'public.authored_definitions'::regclass
  ) THEN
    ALTER TABLE public.authored_definitions
      ADD CONSTRAINT authored_definitions_active_revision_fk FOREIGN KEY (
        subject_id,
        active_revision_id
      ) REFERENCES public.authored_definition_revisions(definition_id, id)
        DEFERRABLE INITIALLY DEFERRED;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'authored_definitions_draft_revision_fk'
      AND conrelid = 'public.authored_definitions'::regclass
  ) THEN
    ALTER TABLE public.authored_definitions
      ADD CONSTRAINT authored_definitions_draft_revision_fk FOREIGN KEY (
        subject_id,
        draft_revision_id
      ) REFERENCES public.authored_definition_revisions(definition_id, id)
        DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

ALTER TABLE public.authored_definitions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.authored_definition_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Definitions are readable by owner or public" ON public.authored_definitions;

CREATE POLICY "Definitions are readable by owner or public" ON public.authored_definitions FOR
SELECT
  TO authenticated USING (
    is_master
    OR owner_user_id = (
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

DROP POLICY IF EXISTS "Users can insert own definitions" ON public.authored_definitions;

CREATE POLICY "Users can insert own definitions" ON public.authored_definitions FOR INSERT TO authenticated
WITH
  CHECK (
    (
      NOT is_master
      AND owner_user_id = (
        SELECT
          auth.uid ()
      )
    )
    OR (
      (
        SELECT
          auth.jwt ()
      )::jsonb -> 'app_metadata' ->> 'admin'
    ) = 'true'
  );

DROP POLICY IF EXISTS "Users can update own definitions" ON public.authored_definitions;

CREATE POLICY "Users can update own definitions" ON public.authored_definitions
FOR UPDATE
  TO authenticated USING (
    owner_user_id = (
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
    owner_user_id = (
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

DROP POLICY IF EXISTS "Users can delete own definitions" ON public.authored_definitions;

CREATE POLICY "Users can delete own definitions" ON public.authored_definitions FOR DELETE TO authenticated USING (
  owner_user_id = (
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

DROP POLICY IF EXISTS "Definition revisions follow definition visibility" ON public.authored_definition_revisions;

CREATE POLICY "Definition revisions follow definition visibility" ON public.authored_definition_revisions FOR
SELECT
  TO authenticated USING (
    EXISTS (
      SELECT
        1
      FROM
        public.authored_definitions definition
      WHERE
        definition.subject_id = definition_id
        AND (
          definition.is_master
          OR definition.owner_user_id = (
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
    )
  );

DROP POLICY IF EXISTS "Users can insert revisions for own definitions" ON public.authored_definition_revisions;

CREATE POLICY "Users can insert revisions for own definitions" ON public.authored_definition_revisions FOR INSERT TO authenticated
WITH
  CHECK (
    EXISTS (
      SELECT
        1
      FROM
        public.authored_definitions definition
      WHERE
        definition.subject_id = definition_id
        AND (
          definition.owner_user_id = (
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
    )
  );

DROP POLICY IF EXISTS "Users can delete revisions for own definitions" ON public.authored_definition_revisions;

CREATE POLICY "Users can delete revisions for own definitions" ON public.authored_definition_revisions FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT
      1
    FROM
      public.authored_definitions definition
    WHERE
      definition.subject_id = definition_id
      AND (
        definition.owner_user_id = (
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
  )
);

CREATE INDEX IF NOT EXISTS idx_authored_definitions_owner ON public.authored_definitions (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_authored_definitions_system ON public.authored_definitions (system_id);

CREATE INDEX IF NOT EXISTS idx_authored_definitions_kind ON public.authored_definitions (subject_kind);

CREATE INDEX IF NOT EXISTS idx_authored_definition_revisions_definition ON public.authored_definition_revisions (definition_id, revision_number DESC);
