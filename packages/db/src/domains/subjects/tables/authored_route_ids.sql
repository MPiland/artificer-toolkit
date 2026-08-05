/* --------------------------------------------------
* AUTHORED ROUTE IDENTITIES
*
* Stable, compact public identifiers for active roots and drafts.
* Subject visibility remains derived from canonical active rows or drafts.
* -------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.base36_encode (value bigint) RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT
SET
  search_path = pg_catalog,
  public AS $$
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

CREATE OR REPLACE FUNCTION public.srd_authored_route_number (subject_id uuid) RETURNS bigint LANGUAGE plpgsql IMMUTABLE STRICT
SET
  search_path = pg_catalog,
  public AS $$
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

CREATE SEQUENCE IF NOT EXISTS public.authored_route_ids_route_number_seq AS bigint START
WITH
  1 INCREMENT BY 1 MINVALUE 1 NO CYCLE;

CREATE TABLE IF NOT EXISTS public.authored_route_ids (
  subject_kind text NOT NULL,
  subject_id uuid NOT NULL,
  route_number bigint NOT NULL DEFAULT nextval(
    'public.authored_route_ids_route_number_seq'::regclass
  ),
  public_id text GENERATED ALWAYS AS (public.base36_encode (route_number)) STORED,
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

ALTER SEQUENCE public.authored_route_ids_route_number_seq OWNED BY public.authored_route_ids.route_number;

CREATE INDEX IF NOT EXISTS idx_authored_route_ids_public_id ON public.authored_route_ids (public_id);

CREATE INDEX IF NOT EXISTS idx_authored_route_ids_subject_kind_public_id ON public.authored_route_ids (subject_kind, public_id);

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
            FROM public.character_builder_drafts draft
            WHERE draft.character_id = p_subject_id
              AND draft.user_id = (SELECT auth.uid())
          )
        )
      )
      OR EXISTS (
        SELECT 1
        FROM (
          SELECT 'BACKGROUND'::text AS subject_kind, id, user_id, system_id, is_master
          FROM public.backgrounds WHERE status = 'ACTIVE'
          UNION ALL
          SELECT 'CLASS', id, user_id, system_id, is_master
          FROM public.classes WHERE status = 'ACTIVE'
          UNION ALL
          SELECT 'CREATURE', id, user_id, system_id, is_master
          FROM public.creatures WHERE status = 'ACTIVE'
          UNION ALL
          SELECT 'EQUIPMENT', id, user_id, system_id, is_master
          FROM public.equipment WHERE status = 'ACTIVE'
          UNION ALL
          SELECT 'FEAT', id, user_id, system_id, is_master
          FROM public.feats WHERE status = 'ACTIVE'
          UNION ALL
          SELECT 'RACE', id, user_id, system_id, is_master
          FROM public.races WHERE status = 'ACTIVE'
          UNION ALL
          SELECT 'SPELL', id, user_id, system_id, is_master
          FROM public.spells WHERE status = 'ACTIVE'
          UNION ALL
          SELECT 'VEHICLE', id, user_id, system_id, is_master
          FROM public.vehicles WHERE status = 'ACTIVE'
        ) root
        JOIN public.systems s ON s.id = root.system_id
        WHERE root.subject_kind = p_subject_kind
          AND root.id = p_subject_id
          AND (
            root.is_master = true
            OR root.user_id = (SELECT auth.uid())
            OR s.user_id = (SELECT auth.uid())
          )
      )
    );
$$;

ALTER TABLE public.authored_route_ids ENABLE ROW LEVEL SECURITY;
