CREATE OR REPLACE FUNCTION public.base36_encode(value bigint)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog, public
AS $$
DECLARE
  alphabet constant text := '0123456789abcdefghijklmnopqrstuvwxyz';
  remaining bigint := value;
  encoded text := '';
  digit integer;
BEGIN
  IF value < 0 THEN
    RAISE EXCEPTION 'base36_encode only supports non-negative values';
  END IF;

  IF value = 0 THEN
    RETURN '0';
  END IF;

  WHILE remaining > 0 LOOP
    digit := (remaining % 36)::integer;
    encoded := substr(alphabet, digit + 1, 1) || encoded;
    remaining := remaining / 36;
  END LOOP;

  RETURN encoded;
END;
$$;

CREATE OR REPLACE FUNCTION public.srd_authored_route_number(subject_id uuid)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog, public
AS $$
DECLARE
  subject_text text := subject_id::text;
  domain_hex text;
  index_hex text;
  domain_bytes bytea;
  index_bytes bytea;
  domain_code bigint;
  subject_index bigint;
BEGIN
  IF subject_text !~ '^00000000-0000-0000-[0-9a-f]{4}-[0-9a-f]{4}00000000$' THEN
    RETURN NULL;
  END IF;

  domain_hex := split_part(subject_text, '-', 4);
  index_hex := left(split_part(subject_text, '-', 5), 4);
  domain_bytes := decode(domain_hex, 'hex');
  index_bytes := decode(index_hex, 'hex');
  domain_code := get_byte(domain_bytes, 0) * 256 + get_byte(domain_bytes, 1);
  subject_index := get_byte(index_bytes, 0) * 256 + get_byte(index_bytes, 1);

  IF domain_code <= 0 OR subject_index <= 0 THEN
    RETURN NULL;
  END IF;

  RETURN domain_code * 100000 + subject_index;
END;
$$;

CREATE TABLE IF NOT EXISTS public.authored_subject_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  subject_kind text NOT NULL,
  subject_id uuid NOT NULL,

  user_id uuid NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  payload jsonb NOT NULL,
  base_active_updated_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT authored_subject_drafts_status_chk CHECK (status = 'DRAFT'),
  CONSTRAINT authored_subject_drafts_kind_chk CHECK (
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
  CONSTRAINT authored_subject_drafts_unique_subject_user UNIQUE (
    subject_kind,
    subject_id,
    user_id
  )
);

ALTER TABLE public.authored_subject_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own authored drafts" ON public.authored_subject_drafts;
CREATE POLICY "Users can select own authored drafts"
  ON public.authored_subject_drafts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own authored drafts" ON public.authored_subject_drafts;
CREATE POLICY "Users can insert own authored drafts"
  ON public.authored_subject_drafts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own authored drafts" ON public.authored_subject_drafts;
CREATE POLICY "Users can update own authored drafts"
  ON public.authored_subject_drafts FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own authored drafts" ON public.authored_subject_drafts;
CREATE POLICY "Users can delete own authored drafts"
  ON public.authored_subject_drafts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_authored_subject_drafts_user
  ON public.authored_subject_drafts(user_id);

CREATE INDEX IF NOT EXISTS idx_authored_subject_drafts_system
  ON public.authored_subject_drafts(system_id);

CREATE INDEX IF NOT EXISTS idx_authored_subject_drafts_subject
  ON public.authored_subject_drafts(subject_kind, subject_id);

CREATE SEQUENCE IF NOT EXISTS public.authored_route_ids_route_number_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO CYCLE;

CREATE TABLE IF NOT EXISTS public.authored_route_ids (
  subject_kind text NOT NULL,
  subject_id uuid NOT NULL,
  route_number bigint NOT NULL DEFAULT nextval('public.authored_route_ids_route_number_seq'::regclass),
  public_id text GENERATED ALWAYS AS (public.base36_encode(route_number)) STORED,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (subject_kind, subject_id),
  CONSTRAINT authored_route_ids_subject_kind_chk CHECK (
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
  CONSTRAINT authored_route_ids_route_number_chk CHECK (route_number > 0),
  CONSTRAINT authored_route_ids_public_id_chk CHECK (public_id ~ '^[0-9a-z]+$'),
  CONSTRAINT authored_route_ids_route_number_unique UNIQUE (route_number),
  CONSTRAINT authored_route_ids_public_id_unique UNIQUE (public_id),
  CONSTRAINT authored_route_ids_subject_public_id_unique UNIQUE (subject_kind, public_id)
);

ALTER SEQUENCE public.authored_route_ids_route_number_seq
  OWNED BY public.authored_route_ids.route_number;

CREATE INDEX IF NOT EXISTS idx_authored_route_ids_public_id
  ON public.authored_route_ids(public_id);

CREATE INDEX IF NOT EXISTS idx_authored_route_ids_subject_kind_public_id
  ON public.authored_route_ids(subject_kind, public_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_authored_route_ids_updated_at'
      AND tgrelid = 'public.authored_route_ids'::regclass
  ) THEN
    CREATE TRIGGER trg_authored_route_ids_updated_at
      BEFORE UPDATE ON public.authored_route_ids
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_authored_route_id(
  p_subject_kind text,
  p_subject_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      (auth.jwt()::jsonb -> 'app_metadata' ->> 'admin') = 'true'
      OR EXISTS (
        SELECT 1
        FROM public.authored_subject_drafts d
        WHERE d.subject_kind = p_subject_kind
          AND d.subject_id = p_subject_id
          AND d.user_id = auth.uid()
      )
      OR (
        p_subject_kind = 'CHARACTER'
        AND (
          EXISTS (
            SELECT 1
            FROM public.characters c
            WHERE c.id = p_subject_id
              AND c.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.character_builder_drafts d
            WHERE d.character_id = p_subject_id
              AND d.user_id = auth.uid()
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
            AND (b.is_master = true OR b.user_id = auth.uid() OR s.user_id = auth.uid())
        )
      )
      OR (
        p_subject_kind = 'CLASS'
        AND EXISTS (
          SELECT 1
          FROM public.classes c
          JOIN public.systems s ON s.id = c.system_id
          WHERE c.id = p_subject_id
            AND (c.is_master = true OR c.user_id = auth.uid() OR s.user_id = auth.uid())
        )
      )
      OR (
        p_subject_kind = 'CREATURE'
        AND EXISTS (
          SELECT 1
          FROM public.creatures c
          JOIN public.systems s ON s.id = c.system_id
          WHERE c.id = p_subject_id
            AND (c.is_master = true OR c.user_id = auth.uid() OR s.user_id = auth.uid())
        )
      )
      OR (
        p_subject_kind = 'EQUIPMENT'
        AND EXISTS (
          SELECT 1
          FROM public.equipment e
          JOIN public.systems s ON s.id = e.system_id
          WHERE e.id = p_subject_id
            AND (e.is_master = true OR e.user_id = auth.uid() OR s.user_id = auth.uid())
        )
      )
      OR (
        p_subject_kind = 'FEAT'
        AND EXISTS (
          SELECT 1
          FROM public.feats f
          JOIN public.systems s ON s.id = f.system_id
          WHERE f.id = p_subject_id
            AND (f.is_master = true OR f.user_id = auth.uid() OR s.user_id = auth.uid())
        )
      )
      OR (
        p_subject_kind = 'RACE'
        AND EXISTS (
          SELECT 1
          FROM public.races r
          JOIN public.systems s ON s.id = r.system_id
          WHERE r.id = p_subject_id
            AND (r.is_master = true OR r.user_id = auth.uid() OR s.user_id = auth.uid())
        )
      )
      OR (
        p_subject_kind = 'SPELL'
        AND EXISTS (
          SELECT 1
          FROM public.spells s1
          JOIN public.systems s ON s.id = s1.system_id
          WHERE s1.id = p_subject_id
            AND (s1.is_master = true OR s1.user_id = auth.uid() OR s.user_id = auth.uid())
        )
      )
      OR (
        p_subject_kind = 'VEHICLE'
        AND EXISTS (
          SELECT 1
          FROM public.vehicles v
          JOIN public.systems s ON s.id = v.system_id
          WHERE v.id = p_subject_id
            AND (v.is_master = true OR v.user_id = auth.uid() OR s.user_id = auth.uid())
        )
      )
    );
$$;

ALTER TABLE public.authored_route_ids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Route identities are readable when subject is visible" ON public.authored_route_ids;
CREATE POLICY "Route identities are readable when subject is visible"
  ON public.authored_route_ids FOR SELECT TO authenticated
  USING (public.can_access_authored_route_id(subject_kind, subject_id));

DROP POLICY IF EXISTS "Route identities can be inserted for visible subjects" ON public.authored_route_ids;
CREATE POLICY "Route identities can be inserted for visible subjects"
  ON public.authored_route_ids FOR INSERT TO authenticated
  WITH CHECK (public.can_access_authored_route_id(subject_kind, subject_id));

DROP POLICY IF EXISTS "Route identities can be updated for visible subjects" ON public.authored_route_ids;

DROP POLICY IF EXISTS "Route identities can be deleted for visible subjects" ON public.authored_route_ids;
CREATE POLICY "Route identities can be deleted for visible subjects"
  ON public.authored_route_ids FOR DELETE TO authenticated
  USING (public.can_access_authored_route_id(subject_kind, subject_id));

GRANT SELECT, INSERT, DELETE ON public.authored_route_ids TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.authored_route_ids_route_number_seq TO authenticated;

WITH active_subjects AS (
  SELECT 'BACKGROUND'::text AS subject_kind, id AS subject_id FROM public.backgrounds
  UNION ALL
  SELECT 'CLASS'::text, id FROM public.classes
  UNION ALL
  SELECT 'CREATURE'::text, id FROM public.creatures
  UNION ALL
  SELECT 'EQUIPMENT'::text, id FROM public.equipment
  UNION ALL
  SELECT 'FEAT'::text, id FROM public.feats
  UNION ALL
  SELECT 'RACE'::text, id FROM public.races
  UNION ALL
  SELECT 'SPELL'::text, id FROM public.spells
  UNION ALL
  SELECT 'VEHICLE'::text, id FROM public.vehicles
  UNION ALL
  SELECT 'CHARACTER'::text, id FROM public.characters
),
draft_subjects AS (
  SELECT subject_kind, subject_id FROM public.authored_subject_drafts
  UNION ALL
  SELECT 'CHARACTER'::text, character_id FROM public.character_builder_drafts
),
subjects AS (
  SELECT DISTINCT subject_kind, subject_id
  FROM (
    SELECT subject_kind, subject_id FROM active_subjects
    UNION ALL
    SELECT subject_kind, subject_id FROM draft_subjects
  ) combined
)
INSERT INTO public.authored_route_ids (
  subject_kind,
  subject_id,
  route_number
)
SELECT
  subject_kind,
  subject_id,
  COALESCE(
    public.srd_authored_route_number(subject_id),
    nextval('public.authored_route_ids_route_number_seq'::regclass)
  )
FROM subjects
ON CONFLICT (subject_kind, subject_id) DO NOTHING;

DO $$
DECLARE
  max_route_number bigint;
BEGIN
  SELECT max(route_number) INTO max_route_number
  FROM public.authored_route_ids;

  IF max_route_number IS NULL THEN
    PERFORM setval('public.authored_route_ids_route_number_seq'::regclass, 1, false);
  ELSE
    PERFORM setval('public.authored_route_ids_route_number_seq'::regclass, max_route_number, true);
  END IF;
END;
$$;
