BEGIN;

LOCK TABLE public.authored_definitions,
public.authored_definition_revisions,
public.authored_route_ids,
public.backgrounds,
public.classes,
public.creatures,
public.equipment,
public.feats,
public.races,
public.spells,
public.vehicles IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    WITH active_roots AS (
      SELECT 'BACKGROUND'::text AS subject_kind, id AS subject_id,
        user_id AS owner_user_id, system_id, label, coalesce(is_master, false) AS is_master
      FROM public.backgrounds WHERE status = 'ACTIVE'
      UNION ALL
      SELECT 'CLASS', id, user_id, system_id, label, coalesce(is_master, false)
      FROM public.classes WHERE status = 'ACTIVE'
      UNION ALL
      SELECT 'CREATURE', id, user_id, system_id, label, coalesce(is_master, false)
      FROM public.creatures WHERE status = 'ACTIVE'
      UNION ALL
      SELECT 'EQUIPMENT', id, user_id, system_id, label, coalesce(is_master, false)
      FROM public.equipment WHERE status = 'ACTIVE'
      UNION ALL
      SELECT 'FEAT', id, user_id, system_id, label, coalesce(is_master, false)
      FROM public.feats WHERE status = 'ACTIVE'
      UNION ALL
      SELECT 'RACE', id, user_id, system_id, label, coalesce(is_master, false)
      FROM public.races WHERE status = 'ACTIVE'
      UNION ALL
      SELECT 'SPELL', id, user_id, system_id, label, coalesce(is_master, false)
      FROM public.spells WHERE status = 'ACTIVE'
      UNION ALL
      SELECT 'VEHICLE', id, user_id, system_id, label, coalesce(is_master, false)
      FROM public.vehicles WHERE status = 'ACTIVE'
    )
    SELECT 1
    FROM public.authored_definitions definition
    JOIN public.authored_definition_revisions active_revision
      ON active_revision.definition_id = definition.subject_id
      AND active_revision.id = definition.active_revision_id
    LEFT JOIN active_roots root
      ON root.subject_kind = definition.subject_kind
      AND root.subject_id = definition.subject_id
    WHERE definition.active_revision_id IS NOT NULL
      AND (
        root.subject_id IS NULL
        OR (
          NOT definition.is_master
          AND root.owner_user_id IS DISTINCT FROM definition.owner_user_id
        )
        OR root.system_id IS DISTINCT FROM definition.system_id
        OR root.label IS DISTINCT FROM (active_revision.payload ->> 'label')
        OR root.is_master IS DISTINCT FROM definition.is_master
      )
  ) THEN
    RAISE EXCEPTION
      'Cannot remove authored revisions because an active definition has no matching ACTIVE root projection.';
  END IF;
END;
$$;

ALTER TABLE public.authored_definition_creation_rate_limits
RENAME TO authored_creation_rate_limits;

ALTER TABLE public.authored_creation_rate_limits
RENAME CONSTRAINT authored_definition_creation_rate_limits_minute_count_chk TO authored_creation_rate_limits_minute_count_chk;

ALTER TABLE public.authored_creation_rate_limits
DROP CONSTRAINT authored_creation_rate_limits_minute_count_chk,
ADD CONSTRAINT authored_creation_rate_limits_minute_count_chk CHECK (minute_count BETWEEN 0 AND 25);

ALTER TABLE public.authored_creation_rate_limits
RENAME CONSTRAINT authored_definition_creation_rate_limits_hour_count_chk TO authored_creation_rate_limits_hour_count_chk;

CREATE TABLE public.authored_drafts (
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

CREATE TABLE public.authored_import_refs (
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

WITH
  active_roots AS (
    SELECT
      'BACKGROUND'::text AS subject_kind,
      id AS subject_id,
      updated_at
    FROM
      public.backgrounds
    WHERE
      status = 'ACTIVE'
    UNION ALL
    SELECT
      'CLASS',
      id,
      updated_at
    FROM
      public.classes
    WHERE
      status = 'ACTIVE'
    UNION ALL
    SELECT
      'CREATURE',
      id,
      updated_at
    FROM
      public.creatures
    WHERE
      status = 'ACTIVE'
    UNION ALL
    SELECT
      'EQUIPMENT',
      id,
      updated_at
    FROM
      public.equipment
    WHERE
      status = 'ACTIVE'
    UNION ALL
    SELECT
      'FEAT',
      id,
      updated_at
    FROM
      public.feats
    WHERE
      status = 'ACTIVE'
    UNION ALL
    SELECT
      'RACE',
      id,
      updated_at
    FROM
      public.races
    WHERE
      status = 'ACTIVE'
    UNION ALL
    SELECT
      'SPELL',
      id,
      updated_at
    FROM
      public.spells
    WHERE
      status = 'ACTIVE'
    UNION ALL
    SELECT
      'VEHICLE',
      id,
      updated_at
    FROM
      public.vehicles
    WHERE
      status = 'ACTIVE'
  )
INSERT INTO
  public.authored_drafts (
    subject_kind,
    subject_id,
    user_id,
    system_id,
    label,
    payload,
    base_active_updated_at,
    created_at,
    updated_at
  )
SELECT
  definition.subject_kind,
  definition.subject_id,
  definition.owner_user_id,
  definition.system_id,
  definition.label,
  revision.payload,
  CASE
    WHEN definition.active_revision_id IS NULL THEN NULL
    WHEN active_root.updated_at IS NULL THEN '-infinity'::timestamptz
    WHEN revision.base_active_revision_id IS NOT DISTINCT FROM definition.active_revision_id THEN active_root.updated_at
    ELSE '-infinity'::timestamptz
  END,
  revision.created_at,
  revision.created_at
FROM
  public.authored_definitions definition
  JOIN public.authored_definition_revisions revision ON revision.definition_id = definition.subject_id
  AND revision.id = definition.draft_revision_id
  LEFT JOIN active_roots active_root ON active_root.subject_kind = definition.subject_kind
  AND active_root.subject_id = definition.subject_id
WHERE
  definition.owner_user_id IS NOT NULL;

ALTER TABLE public.authored_drafts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.authored_import_refs ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX idx_authored_drafts_user_updated ON public.authored_drafts (user_id, updated_at DESC);

CREATE INDEX idx_authored_drafts_system ON public.authored_drafts (system_id);

CREATE INDEX idx_authored_import_refs_subject ON public.authored_import_refs (user_id, subject_kind, subject_id);

REVOKE ALL ON TABLE public.authored_creation_rate_limits,
public.authored_drafts,
public.authored_import_refs
FROM
  anon,
  authenticated;

CREATE OR REPLACE FUNCTION public.can_access_authored_route_id (p_subject_kind text, p_subject_id uuid) RETURNS boolean LANGUAGE sql STABLE
SET
  search_path = public,
  pg_catalog AS $$
  SELECT
    (SELECT auth.uid()) IS NOT NULL
    AND (
      ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
      OR EXISTS (
        SELECT 1
        FROM public.authored_drafts draft
        WHERE draft.subject_kind = p_subject_kind
          AND draft.subject_id = p_subject_id
          AND draft.user_id = (SELECT auth.uid())
      )
      OR (
        p_subject_kind = 'CHARACTER'
        AND (
          EXISTS (
            SELECT 1
            FROM public.characters c
            WHERE c.id = p_subject_id
              AND c.user_id = (SELECT auth.uid())
          )
          OR EXISTS (
            SELECT 1
            FROM public.character_builder_drafts d
            WHERE d.character_id = p_subject_id
              AND d.user_id = (SELECT auth.uid())
          )
        )
      )
      OR (
        p_subject_kind = 'BACKGROUND'
        AND EXISTS (
          SELECT 1
          FROM public.backgrounds b
          JOIN public.systems s ON s.id = b.system_id
          WHERE b.id = p_subject_id
            AND b.status = 'ACTIVE'
            AND (b.is_master = true OR b.user_id = (SELECT auth.uid()) OR s.user_id = (SELECT auth.uid()))
        )
      )
      OR (
        p_subject_kind = 'CLASS'
        AND EXISTS (
          SELECT 1
          FROM public.classes c
          JOIN public.systems s ON s.id = c.system_id
          WHERE c.id = p_subject_id
            AND c.status = 'ACTIVE'
            AND (c.is_master = true OR c.user_id = (SELECT auth.uid()) OR s.user_id = (SELECT auth.uid()))
        )
      )
      OR (
        p_subject_kind = 'CREATURE'
        AND EXISTS (
          SELECT 1
          FROM public.creatures c
          JOIN public.systems s ON s.id = c.system_id
          WHERE c.id = p_subject_id
            AND c.status = 'ACTIVE'
            AND (c.is_master = true OR c.user_id = (SELECT auth.uid()) OR s.user_id = (SELECT auth.uid()))
        )
      )
      OR (
        p_subject_kind = 'EQUIPMENT'
        AND EXISTS (
          SELECT 1
          FROM public.equipment e
          JOIN public.systems s ON s.id = e.system_id
          WHERE e.id = p_subject_id
            AND e.status = 'ACTIVE'
            AND (e.is_master = true OR e.user_id = (SELECT auth.uid()) OR s.user_id = (SELECT auth.uid()))
        )
      )
      OR (
        p_subject_kind = 'FEAT'
        AND EXISTS (
          SELECT 1
          FROM public.feats f
          JOIN public.systems s ON s.id = f.system_id
          WHERE f.id = p_subject_id
            AND f.status = 'ACTIVE'
            AND (f.is_master = true OR f.user_id = (SELECT auth.uid()) OR s.user_id = (SELECT auth.uid()))
        )
      )
      OR (
        p_subject_kind = 'RACE'
        AND EXISTS (
          SELECT 1
          FROM public.races r
          JOIN public.systems s ON s.id = r.system_id
          WHERE r.id = p_subject_id
            AND r.status = 'ACTIVE'
            AND (r.is_master = true OR r.user_id = (SELECT auth.uid()) OR s.user_id = (SELECT auth.uid()))
        )
      )
      OR (
        p_subject_kind = 'SPELL'
        AND EXISTS (
          SELECT 1
          FROM public.spells spell
          JOIN public.systems s ON s.id = spell.system_id
          WHERE spell.id = p_subject_id
            AND spell.status = 'ACTIVE'
            AND (spell.is_master = true OR spell.user_id = (SELECT auth.uid()) OR s.user_id = (SELECT auth.uid()))
        )
      )
      OR (
        p_subject_kind = 'VEHICLE'
        AND EXISTS (
          SELECT 1
          FROM public.vehicles v
          JOIN public.systems s ON s.id = v.system_id
          WHERE v.id = p_subject_id
            AND v.status = 'ACTIVE'
            AND (v.is_master = true OR v.user_id = (SELECT auth.uid()) OR s.user_id = (SELECT auth.uid()))
        )
      )
    );
$$;

REVOKE
EXECUTE ON FUNCTION public.can_access_authored_route_id (text, uuid)
FROM
  public,
  anon,
  authenticated;

WITH
  active_subjects AS (
    SELECT
      'BACKGROUND'::text AS subject_kind,
      id AS subject_id
    FROM
      public.backgrounds
    WHERE
      status = 'ACTIVE'
    UNION ALL
    SELECT
      'CLASS',
      id
    FROM
      public.classes
    WHERE
      status = 'ACTIVE'
    UNION ALL
    SELECT
      'CREATURE',
      id
    FROM
      public.creatures
    WHERE
      status = 'ACTIVE'
    UNION ALL
    SELECT
      'EQUIPMENT',
      id
    FROM
      public.equipment
    WHERE
      status = 'ACTIVE'
    UNION ALL
    SELECT
      'FEAT',
      id
    FROM
      public.feats
    WHERE
      status = 'ACTIVE'
    UNION ALL
    SELECT
      'RACE',
      id
    FROM
      public.races
    WHERE
      status = 'ACTIVE'
    UNION ALL
    SELECT
      'SPELL',
      id
    FROM
      public.spells
    WHERE
      status = 'ACTIVE'
    UNION ALL
    SELECT
      'VEHICLE',
      id
    FROM
      public.vehicles
    WHERE
      status = 'ACTIVE'
    UNION ALL
    SELECT
      'CHARACTER',
      id
    FROM
      public.characters
  ),
  draft_subjects AS (
    SELECT
      subject_kind,
      subject_id
    FROM
      public.authored_drafts
    UNION ALL
    SELECT
      'CHARACTER'::text,
      character_id
    FROM
      public.character_builder_drafts
  ),
  subjects AS (
    SELECT DISTINCT
      subject_kind,
      subject_id
    FROM
      (
        SELECT
          subject_kind,
          subject_id
        FROM
          active_subjects
        UNION ALL
        SELECT
          subject_kind,
          subject_id
        FROM
          draft_subjects
      ) combined
  )
INSERT INTO
  public.authored_route_ids (subject_kind, subject_id, route_number)
SELECT
  subject_kind,
  subject_id,
  COALESCE(
    public.srd_authored_route_number (subject_id),
    nextval(
      'public.authored_route_ids_route_number_seq'::regclass
    )
  )
FROM
  subjects
ON CONFLICT (subject_kind, subject_id) DO NOTHING;

DO $$
DECLARE
  max_route_number bigint;
  sequence_is_called boolean;
  sequence_last_value bigint;
BEGIN
  SELECT max(route_number) INTO max_route_number
  FROM public.authored_route_ids;

  SELECT last_value, is_called
  INTO sequence_last_value, sequence_is_called
  FROM public.authored_route_ids_route_number_seq;

  IF max_route_number IS NULL AND NOT sequence_is_called THEN
    PERFORM setval(
      'public.authored_route_ids_route_number_seq'::regclass,
      sequence_last_value,
      false
    );
  ELSE
    PERFORM setval(
      'public.authored_route_ids_route_number_seq'::regclass,
      greatest(coalesce(max_route_number, 1), sequence_last_value),
      true
    );
  END IF;
END;
$$;

SELECT
  public.apply_updated_at_triggers ();

ALTER TABLE public.authored_definitions
DROP CONSTRAINT authored_definitions_active_revision_fk,
DROP CONSTRAINT authored_definitions_draft_revision_fk;

DROP TABLE public.authored_definition_revisions;

DROP TABLE public.authored_definitions;

COMMIT;
