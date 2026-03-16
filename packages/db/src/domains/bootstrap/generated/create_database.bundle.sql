-- BEGIN INCLUDE: src\domains\utils\create_database.sql
-- psql runner for ETL schema setup
-- Abort on first error
SET client_min_messages TO error;

-- Adjust this to the absolute path of your repo
-- Recommended: gen_random_uuid support
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Keep object creation consistent
SET LOCAL search_path = public, pg_catalog;

-- Harmless for DDL; effective only for DEFERRABLE constraints during DML
SET CONSTRAINTS ALL DEFERRED;

-- 1) Shared primitives (types/functions/views used by others)
-- BEGIN INCLUDE: src\domains\utils\tables\utils.sql
CREATE OR REPLACE FUNCTION public.set_updated_at () RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = pg_catalog,
  public AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.jsonb_has_all (arr jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE
SET
  search_path = pg_catalog,
  public AS $$
  SELECT
    EXISTS (
      SELECT
        1
      FROM
        JSONB_ARRAY_ELEMENTS_TEXT(arr) AS x
      WHERE
        x = 'all');
$$;

CREATE OR REPLACE FUNCTION public.cleanup_owned_rows () RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = pg_catalog,
  public AS $$
DECLARE
  config jsonb;
  entry jsonb;
  col text;
  target_table regclass;
  target_id uuid;
BEGIN
  -- first argument is our JSON config
  config := TG_ARGV[0]::jsonb;
  -- loop over each object in the array
  FOR entry IN
  SELECT
    *
  FROM
    JSONB_ARRAY_ELEMENTS(config)
    LOOP
      target_table := (entry ->> 'table')::regclass;
      -- loop over the columns for this table
      FOR col IN
      SELECT
        JSONB_ARRAY_ELEMENTS_TEXT(entry -> 'columns')
        LOOP
          target_id := (to_jsonb (OLD) ->> col)::uuid;

          IF target_id IS NOT NULL THEN
            EXECUTE FORMAT('delete from %s where id = $1', target_table)
            USING target_id;
          END IF;
          END LOOP;

        END LOOP;

      RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_owned_rows_on_update () RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = pg_catalog,
  public AS $$
DECLARE
  config jsonb;
  entry jsonb;
  col text;
  target_table regclass;
  old_id uuid;
  new_id uuid;
BEGIN
  -- First argument is our JSON config, same shape as cleanup_owned_rows
  config := TG_ARGV[0]::jsonb;

  -- Loop over each { table, columns } entry
  FOR entry IN SELECT * FROM jsonb_array_elements(config)
  LOOP
    target_table := (entry ->> 'table')::regclass;

    -- Loop over each column name in "columns"
    FOR col IN SELECT jsonb_array_elements_text(entry -> 'columns')
    LOOP
      old_id := (to_jsonb(OLD) ->> col)::uuid;
      new_id := (to_jsonb(NEW) ->> col)::uuid;

      -- If the FK changed or became NULL, delete the old owned row
      -- IS DISTINCT FROM treats NULL vs value as "different"
      IF old_id IS NOT NULL AND old_id IS DISTINCT FROM new_id THEN
        EXECUTE format('DELETE FROM %s WHERE id = $1', target_table)
        USING old_id;
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_updated_at_triggers (p_schema text DEFAULT 'public')
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    r RECORD;
    v_trigger_name text;
BEGIN
    FOR r IN (
        SELECT
            c.oid                          AS table_oid,
            n.nspname                      AS schema_name,
            c.relname                      AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = p_schema
          AND c.relkind = 'r'
          AND c.relpersistence = 'p'
          AND EXISTS (
              SELECT 1
              FROM pg_attribute a
              WHERE a.attrelid = c.oid
                AND a.attname = 'updated_at'
                AND a.attnum > 0
                AND NOT a.attisdropped
          )
    )
    LOOP
        v_trigger_name :=
            'trg_' || r.schema_name || '_' || r.table_name || '_set_updated_at';

        -- Only create trigger if it does not already exist
        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgrelid = r.table_oid
              AND tgname = v_trigger_name
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER %I
                 BEFORE UPDATE ON %I.%I
                 FOR EACH ROW
                 EXECUTE FUNCTION public.set_updated_at()',
                v_trigger_name,
                r.schema_name,
                r.table_name
            );
        END IF;
    END LOOP;
END;
$$;
-- END INCLUDE: src\domains\utils\tables\utils.sql
-- BEGIN INCLUDE: src\domains\utils\tables\user_management.sql
/* ──────────────────────────────────────────────
 * USER MANAGEMENT
 *
 * Defines:
 *   - profiles              (public user profile, mirrors auth.users)
 *   - admins                (admin flag table for set_admin_claims)
 *   - handle_new_user()     (trigger: auto-create profile on signup)
 *   - set_admin_claims()    (auth hook: injects admin flag into JWT)
 *   - apply_direct_ownership_policies()
 *       Policy helper for tables owned directly by a user
 *       (user_id column, is_master flag).
 *       Used by: user-owned master-aware tables.
 *   - apply_system_derived_policies()
 *       Policy helper for content scoped to a system row.
 *       (system_id column, is_master flag).
 *       Used by: classes, spells, feats, equipment, races, backgrounds, etc.
 *
 * Storage:
 *   - avatars bucket
 * ────────────────────────────────────────────── */


/* ──────────────────────────────────────────────
 * PROFILES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY
    REFERENCES auth.users ON DELETE CASCADE NOT NULL,

  updated_at timestamptz,
  username   text UNIQUE,
  full_name  text,
  avatar_url text,
  website    text,

  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id);


/* ──────────────────────────────────────────────
 * ADMINS
 *
 * Stores which users have admin privileges.
 * Referenced by set_admin_claims().
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.admins (
  user_id  uuid PRIMARY KEY
    REFERENCES auth.users ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT true
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin flags." ON public.admins;
CREATE POLICY "Admins can view admin flags."
  ON public.admins FOR SELECT TO authenticated
  USING ((auth.jwt()::jsonb -> 'app_metadata' ->> 'admin') = 'true');


/* ──────────────────────────────────────────────
 * TRIGGER: auto-create profile on signup
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SET search_path = pg_catalog, public
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END;
$$;


/* ──────────────────────────────────────────────
 * AUTH HOOK: inject admin flag into JWT
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.set_admin_claims(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  claims   jsonb;
  is_admin boolean;
BEGIN
  claims := COALESCE(event -> 'claims', '{}');

  SELECT EXISTS(
    SELECT 1 FROM public.admins
    WHERE user_id = (event ->> 'user_id')::uuid
      AND is_admin = true
  ) INTO is_admin;

  IF is_admin THEN
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      COALESCE(claims -> 'app_metadata', '{}')
        || jsonb_build_object('admin', 'true')
    );
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;


/* ──────────────────────────────────────────────
 * POLICY HELPER: direct ownership
 *
 * For tables with (user_id, is_master).
 * Users can only read/write their own non-master rows.
 * Admins (JWT app_metadata.admin = 'true') bypass.
 *
 * Usage: SELECT public.apply_direct_ownership_policies('<table_name>');
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.apply_direct_ownership_policies(target_table text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  safe_table  text := pg_catalog.quote_ident(target_table);
  admin_check text := '(auth.jwt()::jsonb -> ''app_metadata'' ->> ''admin'') = ''true''';
BEGIN
  EXECUTE format('ALTER TABLE public.%s ENABLE ROW LEVEL SECURITY', safe_table);

  EXECUTE format('DROP POLICY IF EXISTS "Users can select own rows" ON public.%s', safe_table);
  EXECUTE format('DROP POLICY IF EXISTS "Users can insert own rows" ON public.%s', safe_table);
  EXECUTE format('DROP POLICY IF EXISTS "Users can update own rows" ON public.%s', safe_table);
  EXECUTE format('DROP POLICY IF EXISTS "Users can delete own rows" ON public.%s', safe_table);

  -- SELECT
  EXECUTE format(
    $fmt$
      CREATE POLICY "Users can select own rows" ON public.%s
      FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR (%s));
    $fmt$,
    safe_table, admin_check
  );

  -- INSERT
  EXECUTE format(
    $fmt$
      CREATE POLICY "Users can insert own rows" ON public.%s
      FOR INSERT TO authenticated
      WITH CHECK (
        (user_id = auth.uid() AND COALESCE(is_master, false) = false)
        OR (%s)
      );
    $fmt$,
    safe_table, admin_check
  );

  -- UPDATE
  EXECUTE format(
    $fmt$
      CREATE POLICY "Users can update own rows" ON public.%s
      FOR UPDATE TO authenticated
      USING (
        (user_id = auth.uid() AND COALESCE(is_master, false) = false)
        OR (%s)
      )
      WITH CHECK (
        (user_id = auth.uid() AND COALESCE(is_master, false) = false)
        OR (%s)
      );
    $fmt$,
    safe_table, admin_check, admin_check
  );

  -- DELETE
  EXECUTE format(
    $fmt$
      CREATE POLICY "Users can delete own rows" ON public.%s
      FOR DELETE TO authenticated
      USING (
        (user_id = auth.uid() AND COALESCE(is_master, false) = false)
        OR (%s)
      );
    $fmt$,
    safe_table, admin_check
  );
END;
$$;


/* ──────────────────────────────────────────────
 * POLICY HELPER: system-derived ownership
 *
 * For tables with (system_id, is_master).
 * Rows are readable if: they are master content,
 * or the system belongs to the current user,
 * or the user is an admin.
 * Write access requires the system to belong to the
 * current user and the row to not be master content.
 *
 * Usage: SELECT public.apply_system_derived_policies('classes');
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.apply_system_derived_policies(target_table text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  safe_table  text := pg_catalog.quote_ident(target_table);
  admin_check text := '(auth.jwt()::jsonb -> ''app_metadata'' ->> ''admin'') = ''true''';
BEGIN
  EXECUTE format('ALTER TABLE public.%s ENABLE ROW LEVEL SECURITY', safe_table);

  EXECUTE format('DROP POLICY IF EXISTS "System rows readable"          ON public.%s', safe_table);
  EXECUTE format('DROP POLICY IF EXISTS "Users insert into own systems" ON public.%s', safe_table);
  EXECUTE format('DROP POLICY IF EXISTS "Users update own systems"      ON public.%s', safe_table);
  EXECUTE format('DROP POLICY IF EXISTS "Users delete own systems"      ON public.%s', safe_table);

  -- SELECT
  EXECUTE format(
    $sql$
      CREATE POLICY "System rows readable" ON public.%s
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM systems s
          WHERE s.id = %s.system_id
            AND (
              %s.is_master = true
              OR s.user_id = auth.uid()
              OR %s
            )
        )
      );
    $sql$,
    safe_table, safe_table, safe_table, admin_check
  );

  -- INSERT
  EXECUTE format(
    $sql$
      CREATE POLICY "Users insert into own systems" ON public.%s
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM systems s
          WHERE s.id = %s.system_id
            AND s.user_id = auth.uid()
            AND %s.is_master = false
        )
      );
    $sql$,
    safe_table, safe_table, safe_table
  );

  -- UPDATE
  EXECUTE format(
    $sql$
      CREATE POLICY "Users update own systems" ON public.%s
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM systems s
          WHERE s.id = %s.system_id
            AND s.user_id = auth.uid()
            AND %s.is_master = false
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM systems s
          WHERE s.id = %s.system_id
            AND s.user_id = auth.uid()
            AND %s.is_master = false
        )
      );
    $sql$,
    safe_table, safe_table, safe_table, safe_table, safe_table
  );

  -- DELETE
  EXECUTE format(
    $sql$
      CREATE POLICY "Users delete own systems" ON public.%s
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM systems s
          WHERE s.id = %s.system_id
            AND s.user_id = auth.uid()
            AND %s.is_master = false
        )
      );
    $sql$,
    safe_table, safe_table, safe_table
  );
END;
$$;


/* --------------------------------------------------
 * POLICY HELPER: system vocabulary ownership
 *
 * For lookup tables with (system_id) and no is_master column.
 * Rows are readable when their owning system is visible.
 * Writes are limited to the owner of the system or admins.
 *
 * Usage: SELECT public.apply_system_vocabulary_policies('skills');
 * -------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.apply_system_vocabulary_policies(target_table text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  safe_table  text := pg_catalog.quote_ident(target_table);
  admin_check text := '(auth.jwt()::jsonb -> ''app_metadata'' ->> ''admin'') = ''true''';
BEGIN
  EXECUTE format('ALTER TABLE public.%s ENABLE ROW LEVEL SECURITY', safe_table);

  EXECUTE format('DROP POLICY IF EXISTS "System vocabulary readable" ON public.%s', safe_table);
  EXECUTE format('DROP POLICY IF EXISTS "Users insert into own vocabulary systems" ON public.%s', safe_table);
  EXECUTE format('DROP POLICY IF EXISTS "Users update own vocabulary systems" ON public.%s', safe_table);
  EXECUTE format('DROP POLICY IF EXISTS "Users delete own vocabulary systems" ON public.%s', safe_table);

  EXECUTE format(
    $sql$
      CREATE POLICY "System vocabulary readable" ON public.%s
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.systems s
          WHERE s.id = %s.system_id
            AND (
              s.user_id IS NULL
              OR s.user_id = auth.uid()
              OR %s
            )
        )
      );
    $sql$,
    safe_table, safe_table, admin_check
  );

  EXECUTE format(
    $sql$
      CREATE POLICY "Users insert into own vocabulary systems" ON public.%s
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.systems s
          WHERE s.id = %s.system_id
            AND (
              s.user_id = auth.uid()
              OR %s
            )
        )
      );
    $sql$,
    safe_table, safe_table, admin_check
  );

  EXECUTE format(
    $sql$
      CREATE POLICY "Users update own vocabulary systems" ON public.%s
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.systems s
          WHERE s.id = %s.system_id
            AND (
              s.user_id = auth.uid()
              OR %s
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.systems s
          WHERE s.id = %s.system_id
            AND (
              s.user_id = auth.uid()
              OR %s
            )
        )
      );
    $sql$,
    safe_table, safe_table, admin_check, safe_table, admin_check
  );

  EXECUTE format(
    $sql$
      CREATE POLICY "Users delete own vocabulary systems" ON public.%s
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.systems s
          WHERE s.id = %s.system_id
            AND (
              s.user_id = auth.uid()
              OR %s
            )
        )
      );
    $sql$,
    safe_table, safe_table, admin_check
  );
END;
$$;


/* ──────────────────────────────────────────────
 * STORAGE: avatars bucket
 * ────────────────────────────────────────────── */

INSERT INTO storage.buckets (id, name)
VALUES ('avatars', 'avatars')
ON CONFLICT (id) DO NOTHING;
-- END INCLUDE: src\domains\utils\tables\user_management.sql
-- BEGIN INCLUDE: src\domains\subjects\tables\systems.sql
/* ──────────────────────────────────────────────
 * SYSTEMS — ROOT
 *
 * Intent:
 *   A System is the top-level owned container for all author-extensible
 *   vocabularies (skills, senses, damage types, etc.). Other authored
 *   entities reference these tables by id.
 *
 * Notes:
 *   - Vocabulary rows are owned by the System via system_id.
 *   - Stale deletes are performed per vocabulary surface by id.
 *   - No per-table updated_at triggers (handled globally).
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.systems (
  id uuid PRIMARY KEY,

  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  description text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Systems are readable by owner or public." ON public.systems;
CREATE POLICY "Systems are readable by owner or public."
  ON public.systems FOR SELECT TO authenticated
  USING (
    user_id IS NULL
    OR user_id = auth.uid()
    OR (auth.jwt()::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Users can insert own systems." ON public.systems;
CREATE POLICY "Users can insert own systems."
  ON public.systems FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR (auth.jwt()::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Users can update own systems." ON public.systems;
CREATE POLICY "Users can update own systems."
  ON public.systems FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt()::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (auth.jwt()::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Users can delete own systems." ON public.systems;
CREATE POLICY "Users can delete own systems."
  ON public.systems FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt()::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

CREATE INDEX IF NOT EXISTS idx_systems_user
  ON public.systems(user_id);


/* ──────────────────────────────────────────────
 * VOCABULARY TABLE TEMPLATE
 *
 * Columns:
 *  - id: authored UUID
 *  - system_id: owning system
 *  - code: author-extensible code (string)
 *  - label/description/tooltip/short: presentation
 * ────────────────────────────────────────────── */


/* ──────────────────────────────────────────────
 * ALIGNMENTS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.alignments (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alignments ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('alignments');

CREATE UNIQUE INDEX IF NOT EXISTS uq_alignments_system_code
  ON public.alignments(system_id, code);

CREATE INDEX IF NOT EXISTS idx_alignments_system
  ON public.alignments(system_id);


/* ──────────────────────────────────────────────
 * CONDITIONS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.condition_types (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.condition_types ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('condition_types');

CREATE UNIQUE INDEX IF NOT EXISTS uq_condition_types_system_code
  ON public.condition_types(system_id, code);

CREATE INDEX IF NOT EXISTS idx_condition_types_system
  ON public.condition_types(system_id);


/* ──────────────────────────────────────────────
 * CURRENCIES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.currencies (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('currencies');

CREATE UNIQUE INDEX IF NOT EXISTS uq_currencies_system_code
  ON public.currencies(system_id, code);

CREATE INDEX IF NOT EXISTS idx_currencies_system
  ON public.currencies(system_id);


/* ──────────────────────────────────────────────
 * DAMAGE TYPES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.damage_types (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.damage_types ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('damage_types');

CREATE UNIQUE INDEX IF NOT EXISTS uq_damage_types_system_code
  ON public.damage_types(system_id, code);

CREATE INDEX IF NOT EXISTS idx_damage_types_system
  ON public.damage_types(system_id);


/* ──────────────────────────────────────────────
 * LANGUAGES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.languages (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('languages');

CREATE UNIQUE INDEX IF NOT EXISTS uq_languages_system_code
  ON public.languages(system_id, code);

CREATE INDEX IF NOT EXISTS idx_languages_system
  ON public.languages(system_id);


/* ──────────────────────────────────────────────
 * MAGIC SCHOOLS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.magic_schools (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.magic_schools ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('magic_schools');

CREATE UNIQUE INDEX IF NOT EXISTS uq_magic_schools_system_code
  ON public.magic_schools(system_id, code);

CREATE INDEX IF NOT EXISTS idx_magic_schools_system
  ON public.magic_schools(system_id);


/* ──────────────────────────────────────────────
 * PASSIVES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.passives (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.passives ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('passives');

CREATE UNIQUE INDEX IF NOT EXISTS uq_passives_system_code
  ON public.passives(system_id, code);

CREATE INDEX IF NOT EXISTS idx_passives_system
  ON public.passives(system_id);


/* ──────────────────────────────────────────────
 * RARITIES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.rarities (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rarities ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('rarities');

CREATE UNIQUE INDEX IF NOT EXISTS uq_rarities_system_code
  ON public.rarities(system_id, code);

CREATE INDEX IF NOT EXISTS idx_rarities_system
  ON public.rarities(system_id);


/* ──────────────────────────────────────────────
 * SENSES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.senses (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.senses ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('senses');

CREATE UNIQUE INDEX IF NOT EXISTS uq_senses_system_code
  ON public.senses(system_id, code);

CREATE INDEX IF NOT EXISTS idx_senses_system
  ON public.senses(system_id);


/* ──────────────────────────────────────────────
 * SKILLS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('skills');

CREATE UNIQUE INDEX IF NOT EXISTS uq_skills_system_code
  ON public.skills(system_id, code);

CREATE INDEX IF NOT EXISTS idx_skills_system
  ON public.skills(system_id);


/* ──────────────────────────────────────────────
 * SPEEDS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.speeds (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.speeds ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('speeds');

CREATE UNIQUE INDEX IF NOT EXISTS uq_speeds_system_code
  ON public.speeds(system_id, code);

CREATE INDEX IF NOT EXISTS idx_speeds_system
  ON public.speeds(system_id);


/* ──────────────────────────────────────────────
 * TERRAINS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.terrains (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  code text NOT NULL,
  label text NOT NULL,
  description text,
  tooltip text,
  short text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.terrains ENABLE ROW LEVEL SECURITY;
SELECT public.apply_system_vocabulary_policies('terrains');

CREATE UNIQUE INDEX IF NOT EXISTS uq_terrains_system_code
  ON public.terrains(system_id, code);

CREATE INDEX IF NOT EXISTS idx_terrains_system
  ON public.terrains(system_id);
-- END INCLUDE: src\domains\subjects\tables\systems.sql
-- BEGIN INCLUDE: src\domains\shared\tables\charges.sql
/* ──────────────────────────────────────────────
 * CHARGES
 *
 * Root authored charge definition.
 *
 * Cardinality:
 *   systems 1 ──▶ N charges
 *
 * Owns:
 *   charge_limits
 *   charge_scaling_levels
 *   charge_bonus_kinds
 *   charge_bonuses
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.charges (
  id uuid PRIMARY KEY,

  scaling_kind text NOT NULL,     -- SCALING_KIND
  reset_kind text NOT NULL,       -- CHARGE_RESET_KIND

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CHARGE LIMITS
 *
 * Discriminated limit payload.
 * Exactly one row per charge.
 *
 * Corresponds to:
 *   ChargeLimitPayload
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.charge_limits (
  charge_id uuid PRIMARY KEY
    REFERENCES public.charges(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  limit_kind text NOT NULL,       -- CHARGE_LIMIT_KIND
  class_id uuid,

  /* FIXED_AMOUNT */
  amount integer,

  /* CHARACTER_LEVEL | CLASS_LEVEL | PARENT_CLASS_LEVEL | SPELL_CAST_LEVEL */
  multiplier numeric,
  min integer,
  max integer,

  CONSTRAINT charge_limits_fixed_amount_chk CHECK (
    (limit_kind = 'FIXED_AMOUNT' AND amount IS NOT NULL AND class_id IS NULL)
    OR (limit_kind IN ('CHARACTER_LEVEL', 'CLASS_LEVEL', 'PARENT_CLASS_LEVEL', 'SPELL_CAST_LEVEL') AND amount IS NULL)
  ),
  CONSTRAINT charge_limits_class_level_chk CHECK (
    (limit_kind = 'CLASS_LEVEL' AND class_id IS NOT NULL)
    OR (limit_kind <> 'CLASS_LEVEL' AND class_id IS NULL)
  )
);

ALTER TABLE public.charge_limits ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CHARGE SCALING LEVELS
 *
 * Level-based scaling values.
 * Present only when scaling_kind = PER_LEVEL.
 *
 * Corresponds to:
 *   LevelScaledValue<{ amount: number }>
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.charge_scaling_levels (
  id uuid PRIMARY KEY,
  charge_id uuid NOT NULL
    REFERENCES public.charges(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  level integer NOT NULL,
  sort_order integer NOT NULL,
  amount integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (charge_id, level),
  UNIQUE (charge_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_charge_scaling_levels_charge
  ON public.charge_scaling_levels(charge_id);

ALTER TABLE public.charge_scaling_levels ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CHARGE BONUSES
 *
 * Bonus payloads.
 * Exactly one row per (charge, bonus_kind).
 *
 * Corresponds to:
 *   ChargeBonusAuthored
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.charge_bonuses (
  id uuid PRIMARY KEY,
  charge_id uuid NOT NULL
    REFERENCES public.charges(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  bonus_kind text NOT NULL,       -- CHARGE_BONUS_KIND

  /* ABILITY_MODIFIER */
  ability_code text,

  /* SKILL_BONUS */
  skill_id uuid
    REFERENCES public.skills(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  /* shared numeric modifiers */
  multiplier numeric,
  min integer,
  max integer,

  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (charge_id, sort_order),
  CONSTRAINT charge_bonuses_ability_payload_chk CHECK (
    (bonus_kind = 'ABILITY_MODIFIER' AND ability_code IS NOT NULL AND skill_id IS NULL)
    OR (bonus_kind <> 'ABILITY_MODIFIER')
  ),
  CONSTRAINT charge_bonuses_skill_payload_chk CHECK (
    (bonus_kind = 'SKILL_BONUS' AND skill_id IS NOT NULL AND ability_code IS NULL)
    OR (bonus_kind <> 'SKILL_BONUS')
  ),
  CONSTRAINT charge_bonuses_other_payload_chk CHECK (
    (bonus_kind = 'PROFICIENCY_BONUS' AND ability_code IS NULL AND skill_id IS NULL)
    OR (bonus_kind <> 'PROFICIENCY_BONUS')
  )
);

ALTER TABLE public.charge_bonuses ENABLE ROW LEVEL SECURITY;
-- END INCLUDE: src\domains\shared\tables\charges.sql
-- BEGIN INCLUDE: src\domains\shared\tables\details.sql
/*************************************************
 * DETAILS — STANDALONE AUTHORED ENTITY
 *************************************************/

CREATE TABLE IF NOT EXISTS public.details (
  id uuid PRIMARY KEY,

  label text NOT NULL,
  description text NOT NULL,

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.details ENABLE ROW LEVEL SECURITY;
-- END INCLUDE: src\domains\shared\tables\details.sql
-- BEGIN INCLUDE: src\domains\shared\tables\characteristics.sql
/* ──────────────────────────────────────────────
 * CHARACTERISTICS — SHARED STRUCTURAL ENTITY
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.characteristics (
  id uuid PRIMARY KEY,

  code text NOT NULL,   -- RANGE | DURATION | SHAPE

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_characteristics_code
  ON public.characteristics (code);

ALTER TABLE public.characteristics ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CHARACTERISTICS — RANGE SIZES
 * ────────────────────────────────────────────── */
 
 CREATE TABLE IF NOT EXISTS public.characteristic_ranges (
  characteristic_id uuid PRIMARY KEY
    REFERENCES characteristics(id) ON DELETE CASCADE,

  kind text NOT NULL,   -- DISTANCE | SELF | SIGHT | TOUCH | UNLIMITED
  min integer,
  max integer,
  unit_code text,

  CHECK (
    (kind = 'DISTANCE' AND min IS NOT NULL)
    OR
    (kind <> 'DISTANCE' AND min IS NULL AND max IS NULL AND unit_code IS NULL)
  )  
);

ALTER TABLE public.characteristic_ranges ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CHARACTERISTICS — SHAPES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.characteristic_shapes (
  characteristic_id uuid PRIMARY KEY
    REFERENCES characteristics(id) ON DELETE CASCADE,

  kind text NOT NULL
    -- NONE | LINE | CONE | CUBE | CYLINDER | SPHERE | DOME | CIRCLE | WALL
);

ALTER TABLE public.characteristic_shapes ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CHARACTERISTICS — SHAPE DIMENSIONS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.characteristic_shape_dimensions (
  characteristic_id uuid NOT NULL
    REFERENCES characteristic_shapes(characteristic_id) ON DELETE CASCADE,

  dimension text NOT NULL,
    -- RADIUS | HEIGHT | LENGTH | EDGE_LENGTH | THICKNESS

  amount integer NOT NULL,
  unit_code text NOT NULL,

  PRIMARY KEY (characteristic_id, dimension)
);

CREATE INDEX IF NOT EXISTS idx_characteristic_shape_dimensions_characteristic_id
  ON public.characteristic_shape_dimensions (characteristic_id);

ALTER TABLE public.characteristic_shape_dimensions ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CHARACTERISTICS — DURATIONS
 * ────────────────────────────────────────────── */
 
 CREATE TABLE IF NOT EXISTS public.characteristic_durations (
  characteristic_id uuid PRIMARY KEY
    REFERENCES characteristics(id) ON DELETE CASCADE,

  kind text NOT NULL,   -- INSTANTANEOUS | DAY | HOUR | MINUTE | MONTH | ROUND | TURN | WEEK | YEAR
  amount integer
);

ALTER TABLE public.characteristic_durations ENABLE ROW LEVEL SECURITY;
-- END INCLUDE: src\domains\shared\tables\characteristics.sql
-- BEGIN INCLUDE: src\domains\shared\tables\facets.sql
/* ============================================================================
 * FACETS — FULLY NORMALIZED (NO JSONB)
 *
 * Storage model
 * - Facet: OR-of-groups
 * - Group: AND-of-contexts
 * - Context: subject-scoped body (selection + OR-of-AND conditions)
 * - Body: single-subject OR-of-AND groups (reused by Context bodies and EXISTS.where)
 * - Condition: discriminated union { PREDICATE | EXISTS }
 *
 * Notes
 * - RLS is enabled on every table in this file.
 * - CREATE POLICY statements are intentionally omitted (applied elsewhere).
 * - updated_at triggers are intentionally omitted (applied elsewhere).
 * - Enum-like values are stored as TEXT (validated by application/compiler).
 * ========================================================================== */

-- =============================================================================
-- 1) Facet roots
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.facets (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.facet_groups (
  id uuid PRIMARY KEY,
  facet_id uuid NOT NULL
    REFERENCES public.facets (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_groups ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_groups_facet_id
  ON public.facet_groups (facet_id);

-- =============================================================================
-- 2) Contexts (AND across subjects within a facet group)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.facet_contexts (
  id uuid PRIMARY KEY,
  facet_group_id uuid NOT NULL
    REFERENCES public.facet_groups (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  node_subject_code text NOT NULL,
  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_contexts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_contexts_group_id
  ON public.facet_contexts (facet_group_id);

CREATE INDEX IF NOT EXISTS idx_facet_contexts_subject
  ON public.facet_contexts (node_subject_code);

-- =============================================================================
-- 3) Bodies (single-subject OR-of-AND)
--    Used by:
--    - facet_context_bodies (context body)
--    - facet_conditions.where_facet_body_id (EXISTS.where body)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.facet_bodies (
  id uuid PRIMARY KEY,

  /* Subject of this body. Redundant with facet_contexts.node_subject_code for
   * context bodies, but required for EXISTS.where bodies and convenient for
   * integrity checks at the application/compiler layer.
   */
  node_subject_code text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_bodies ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_bodies_subject
  ON public.facet_bodies (node_subject_code);

CREATE TABLE IF NOT EXISTS public.facet_context_bodies (
  facet_context_id uuid PRIMARY KEY
    REFERENCES public.facet_contexts (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  facet_body_id uuid NOT NULL
    REFERENCES public.facet_bodies (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.facet_context_bodies ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_context_bodies_body_id
  ON public.facet_context_bodies (facet_body_id);

CREATE TABLE IF NOT EXISTS public.facet_body_groups (
  id uuid PRIMARY KEY,
  facet_body_id uuid NOT NULL
    REFERENCES public.facet_bodies (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_body_groups ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_body_groups_body_id
  ON public.facet_body_groups (facet_body_id);

-- =============================================================================
-- 4) Body selection (Selectable<SubjectSelectionPayload<S>>)
--    This is FacetBodyAuthored.selection.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.facet_body_selections (
  facet_body_id uuid PRIMARY KEY
    REFERENCES public.facet_bodies (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  authoring_mode_kind text NOT NULL, -- ALL | SELECTED

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facet_body_selections_mode_chk CHECK (
    authoring_mode_kind IN ('ALL', 'SELECTED')
  )
);

ALTER TABLE public.facet_body_selections ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_body_selections_mode
  ON public.facet_body_selections (authoring_mode_kind);

-- Selected IDs for body selection (only when authoring_mode_kind = SELECTED).
-- Polymorphic “one-of” row; stored as FK columns (no arrays, no jsonb).
CREATE TABLE IF NOT EXISTS public.facet_body_selection_items (
  facet_body_id uuid NOT NULL
    REFERENCES public.facet_bodies (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  /* One-of subject payload identifiers */
  class_id uuid,
  feature_id uuid,
  spell_id uuid,
  equipment_id uuid,
  feat_id uuid,
  race_id uuid,
  background_id uuid,
  option_id uuid,

  /* Modeled as IDs in existing tables */
  subrace_id uuid,
  subclass_id uuid,
  resource_id uuid,
  ancestry_option_id uuid,
  proficiency_kind text,
  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT facet_body_selection_items_one_chk CHECK (
    (class_id IS NOT NULL)::int
    + (feature_id IS NOT NULL)::int
    + (spell_id IS NOT NULL)::int
    + (equipment_id IS NOT NULL)::int
    + (feat_id IS NOT NULL)::int
    + (race_id IS NOT NULL)::int
    + (background_id IS NOT NULL)::int
    + (option_id IS NOT NULL)::int
    + (subrace_id IS NOT NULL)::int
    + (subclass_id IS NOT NULL)::int
    + (resource_id IS NOT NULL)::int
    + (ancestry_option_id IS NOT NULL)::int
    + (proficiency_kind IS NOT NULL)::int
    = 1
  )
);

ALTER TABLE public.facet_body_selection_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_body_selection_items_body_id
  ON public.facet_body_selection_items (facet_body_id);

-- =============================================================================
-- 5) Conditions (AND list within a body group)
--    Discriminated union:
--    - PREDICATE: predicate_code + normalized payload tables
--    - EXISTS: relation_code + optional relation selection + optional where body
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.facet_conditions (
  id uuid PRIMARY KEY,

  facet_body_group_id uuid NOT NULL
    REFERENCES public.facet_body_groups (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  kind text NOT NULL,             -- PREDICATE | EXISTS
  constraint_code text NOT NULL,  -- INCLUDE | EXCLUDE
  sort_order integer NOT NULL,

  /* PREDICATE fields */
  predicate_code text,

  /* EXISTS fields */
  relation_code text,
  where_facet_body_id uuid
    REFERENCES public.facet_bodies (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT facet_conditions_kind_chk
    CHECK (kind IN ('PREDICATE', 'EXISTS')),

  CONSTRAINT facet_conditions_predicate_fields_chk CHECK (
    (kind <> 'PREDICATE')
    OR (
      predicate_code IS NOT NULL
      AND relation_code IS NULL
      AND where_facet_body_id IS NULL
    )
  ),

  CONSTRAINT facet_conditions_exists_fields_chk CHECK (
    (kind <> 'EXISTS')
    OR (
      relation_code IS NOT NULL
      AND predicate_code IS NULL
      -- where_facet_body_id is optional for EXISTS
    )
  )
);

ALTER TABLE public.facet_conditions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_conditions_body_group_id
  ON public.facet_conditions (facet_body_group_id);

CREATE INDEX IF NOT EXISTS idx_facet_conditions_kind
  ON public.facet_conditions (kind);

CREATE INDEX IF NOT EXISTS idx_facet_conditions_predicate_code
  ON public.facet_conditions (predicate_code);

CREATE INDEX IF NOT EXISTS idx_facet_conditions_relation_code
  ON public.facet_conditions (relation_code);

CREATE INDEX IF NOT EXISTS idx_facet_conditions_where_body_id
  ON public.facet_conditions (where_facet_body_id);

-- =============================================================================
-- 6) EXISTS relation selection (Selectable<SubjectSelectionPayload<RelationTargetSubject>>)
--    Stored only for EXISTS conditions.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.facet_exists_selections (
  facet_condition_id uuid PRIMARY KEY
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  authoring_mode_kind text NOT NULL, -- ALL | SELECTED

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facet_exists_selections_mode_chk CHECK (
    authoring_mode_kind IN ('ALL', 'SELECTED')
  )
);

ALTER TABLE public.facet_exists_selections ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_exists_selections_mode
  ON public.facet_exists_selections (authoring_mode_kind);

CREATE TABLE IF NOT EXISTS public.facet_exists_selection_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  /* One-of related-subject identifiers */
  class_id uuid,
  feature_id uuid,
  spell_id uuid,
  equipment_id uuid,
  feat_id uuid,
  race_id uuid,
  background_id uuid,
  option_id uuid,

  subrace_id uuid,
  subclass_id uuid,
  resource_id uuid,
  ancestry_option_id uuid,
  proficiency_kind text,
  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT facet_exists_selection_items_one_chk CHECK (
    (class_id IS NOT NULL)::int
    + (feature_id IS NOT NULL)::int
    + (spell_id IS NOT NULL)::int
    + (equipment_id IS NOT NULL)::int
    + (feat_id IS NOT NULL)::int
    + (race_id IS NOT NULL)::int
    + (background_id IS NOT NULL)::int
    + (option_id IS NOT NULL)::int
    + (subrace_id IS NOT NULL)::int
    + (subclass_id IS NOT NULL)::int
    + (resource_id IS NOT NULL)::int
    + (ancestry_option_id IS NOT NULL)::int
    + (proficiency_kind IS NOT NULL)::int
    = 1
  )
);

ALTER TABLE public.facet_exists_selection_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_exists_selection_items_condition_id
  ON public.facet_exists_selection_items (facet_condition_id);

-- =============================================================================
-- 7) Predicate payloads (normalized)
--    These tables are keyed by facet_condition_id (kind=PREDICATE).
--    SQL does not enforce predicate_code-to-payload compatibility; compiler does.
-- =============================================================================

/* Selectable header for predicate payloads that use Selectable<...> */
CREATE TABLE IF NOT EXISTS public.facet_predicate_selectables (
  facet_condition_id uuid PRIMARY KEY
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  authoring_mode_kind text NOT NULL, -- ALL | SELECTED

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facet_predicate_selectables_mode_chk CHECK (
    authoring_mode_kind IN ('ALL', 'SELECTED')
  )
);

ALTER TABLE public.facet_predicate_selectables ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_selectables_mode
  ON public.facet_predicate_selectables (authoring_mode_kind);

/* Generic numeric range payloads: min/max */
CREATE TABLE IF NOT EXISTS public.facet_predicate_numeric_ranges (
  facet_condition_id uuid PRIMARY KEY
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  min_value numeric NOT NULL,
  max_value numeric,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_predicate_numeric_ranges ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_numeric_ranges_min
  ON public.facet_predicate_numeric_ranges (min_value);

/* RangeKind payload (+ optional distance bounds) */
CREATE TABLE IF NOT EXISTS public.facet_predicate_ranges (
  facet_condition_id uuid PRIMARY KEY
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  range_kind text, -- RangeKind
  min_distance integer,
  max_distance integer,
  unit_code text, -- MeasurementUnitCode

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT facet_predicate_ranges_distance_chk CHECK (
    (
      range_kind IS NULL
      AND min_distance IS NOT NULL
      AND unit_code IS NOT NULL
    )
    OR
    (
      range_kind <> 'DISTANCE'
      AND range_kind IS NOT NULL
      AND min_distance IS NULL
      AND max_distance IS NULL
      AND unit_code IS NULL
    )
    OR
    (
      range_kind = 'DISTANCE'
      AND min_distance IS NOT NULL
      AND unit_code IS NOT NULL
    )
  )
);

ALTER TABLE public.facet_predicate_ranges ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_ranges_kind
  ON public.facet_predicate_ranges (range_kind);

/* Selected RangeKind list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_range_kind_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  range_kind text NOT NULL, -- RangeKind
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, range_kind)
);

ALTER TABLE public.facet_predicate_range_kind_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_range_kind_items_condition
  ON public.facet_predicate_range_kind_items (facet_condition_id);

/* DurationKind payload (+ optional bounds) */
CREATE TABLE IF NOT EXISTS public.facet_predicate_durations (
  facet_condition_id uuid PRIMARY KEY
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  duration_kind text, -- DurationKind
  min_amount integer,
  max_amount integer,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT facet_predicate_durations_inst_chk CHECK (
    (
      duration_kind IS NULL
      AND min_amount IS NOT NULL
    )
    OR (
      duration_kind = 'INSTANTANEOUS'
      AND min_amount IS NULL
      AND max_amount IS NULL
    )
    OR (
      duration_kind <> 'INSTANTANEOUS'
      AND min_amount IS NOT NULL
    )
  )
);

ALTER TABLE public.facet_predicate_durations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_durations_kind
  ON public.facet_predicate_durations (duration_kind);

/* Selected DurationKind list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_duration_kind_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  duration_kind text NOT NULL, -- DurationKind
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, duration_kind)
);

ALTER TABLE public.facet_predicate_duration_kind_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_duration_kind_items_condition
  ON public.facet_predicate_duration_kind_items (facet_condition_id);

/* Equipment category payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_equipment_categories (
  facet_condition_id uuid PRIMARY KEY
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  category_code text NOT NULL, -- EquipmentCategoryCode

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_predicate_equipment_categories ENABLE ROW LEVEL SECURITY;

/* Proficiency level payload (ScalingAmountKind) */
CREATE TABLE IF NOT EXISTS public.facet_predicate_proficiency_levels (
  facet_condition_id uuid PRIMARY KEY
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  proficiency_level text NOT NULL, -- ScalingAmountKind

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facet_predicate_proficiency_levels ENABLE ROW LEVEL SECURITY;

/* Ability list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_ability_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  ability_code text NOT NULL, -- AbilityCode
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, ability_code)
);

ALTER TABLE public.facet_predicate_ability_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_ability_items_condition
  ON public.facet_predicate_ability_items (facet_condition_id);

/* Equipment property list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_equipment_property_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  property_code text NOT NULL, -- EquipmentPropertyCode
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, property_code)
);

ALTER TABLE public.facet_predicate_equipment_property_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_equipment_property_items_condition
  ON public.facet_predicate_equipment_property_items (facet_condition_id);

/* Skill list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_skill_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  skill_id uuid NOT NULL
    REFERENCES public.skills (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, skill_id)
);

ALTER TABLE public.facet_predicate_skill_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_skill_items_condition
  ON public.facet_predicate_skill_items (facet_condition_id);

/* Language list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_language_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  language_id uuid NOT NULL
    REFERENCES public.languages (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, language_id)
);

ALTER TABLE public.facet_predicate_language_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_language_items_condition
  ON public.facet_predicate_language_items (facet_condition_id);

/* Magic school list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_magic_school_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  magic_school_id uuid NOT NULL
    REFERENCES public.magic_schools (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, magic_school_id)
);

ALTER TABLE public.facet_predicate_magic_school_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_magic_school_items_condition
  ON public.facet_predicate_magic_school_items (facet_condition_id);

/* Damage type list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_damage_type_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  damage_type_id uuid NOT NULL
    REFERENCES public.damage_types (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, damage_type_id)
);

ALTER TABLE public.facet_predicate_damage_type_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_damage_type_items_condition
  ON public.facet_predicate_damage_type_items (facet_condition_id);

/* Condition type list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_condition_type_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  condition_type_id uuid NOT NULL
    REFERENCES public.condition_types (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, condition_type_id)
);

ALTER TABLE public.facet_predicate_condition_type_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_condition_type_items_condition
  ON public.facet_predicate_condition_type_items (facet_condition_id);

/* Subclass subtype list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_subclass_subtype_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  subtype_id text NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, subtype_id)
);

ALTER TABLE public.facet_predicate_subclass_subtype_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_subclass_subtype_items_condition
  ON public.facet_predicate_subclass_subtype_items (facet_condition_id);

/* Size list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_size_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  size_code text NOT NULL, -- SizeCode
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, size_code)
);

ALTER TABLE public.facet_predicate_size_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_size_items_condition
  ON public.facet_predicate_size_items (facet_condition_id);

/* Charge limit kind list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_charge_limit_kind_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  charge_limit_kind text NOT NULL, -- ChargeLimitKind
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, charge_limit_kind)
);

ALTER TABLE public.facet_predicate_charge_limit_kind_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_charge_limit_kind_items_condition
  ON public.facet_predicate_charge_limit_kind_items (facet_condition_id);

/* Charge reset kind list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_charge_reset_kind_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  charge_reset_kind text NOT NULL, -- ChargeResetKind
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, charge_reset_kind)
);

ALTER TABLE public.facet_predicate_charge_reset_kind_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_charge_reset_kind_items_condition
  ON public.facet_predicate_charge_reset_kind_items (facet_condition_id);

/* Spell list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_spell_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  spell_id uuid NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, spell_id)
);

ALTER TABLE public.facet_predicate_spell_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_spell_items_condition
  ON public.facet_predicate_spell_items (facet_condition_id);

/* Feat list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_feat_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  feat_id uuid NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, feat_id)
);

ALTER TABLE public.facet_predicate_feat_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_feat_items_condition
  ON public.facet_predicate_feat_items (facet_condition_id);

/* Feature list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_feature_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  feature_id uuid NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, feature_id)
);

ALTER TABLE public.facet_predicate_feature_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_feature_items_condition
  ON public.facet_predicate_feature_items (facet_condition_id);

/* Option list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_option_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  option_id uuid NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, option_id)
);

ALTER TABLE public.facet_predicate_option_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_option_items_condition
  ON public.facet_predicate_option_items (facet_condition_id);

/* Equipment list payload */
CREATE TABLE IF NOT EXISTS public.facet_predicate_equipment_items (
  facet_condition_id uuid NOT NULL
    REFERENCES public.facet_conditions (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  equipment_id uuid NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (facet_condition_id, equipment_id)
);

ALTER TABLE public.facet_predicate_equipment_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facet_predicate_equipment_items_condition
  ON public.facet_predicate_equipment_items (facet_condition_id);
-- END INCLUDE: src\domains\shared\tables\facets.sql
-- BEGIN INCLUDE: src\domains\shared\tables\saving_throws.sql
/* ──────────────────────────────────────────────
 * SAVING THROWS — STANDALONE AUTHORED ENTITY
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.saving_throws (
  id uuid PRIMARY KEY,

  saving_throw_kind text NOT NULL,          -- SAVING_THROW_KIND (string)
  ability_code text,                -- ABILITY_CODE (FIXED_VALUE only)

  dc integer,                        -- only for FIXED_VALUE

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT saving_throws_kind_chk CHECK (
    saving_throw_kind IN ('SOURCE_SAVE_DC', 'FIXED_VALUE')
  ),
  CONSTRAINT saving_throws_payload_chk CHECK (
    (saving_throw_kind = 'SOURCE_SAVE_DC' AND ability_code IS NULL AND dc IS NULL)
    OR (saving_throw_kind = 'FIXED_VALUE' AND ability_code IS NOT NULL AND dc IS NOT NULL)
  )
);

ALTER TABLE public.saving_throws ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_saving_throws_kind
  ON public.saving_throws (saving_throw_kind);

CREATE INDEX IF NOT EXISTS idx_saving_throws_ability
  ON public.saving_throws (ability_code);
-- END INCLUDE: src\domains\shared\tables\saving_throws.sql
-- BEGIN INCLUDE: src\domains\shared\tables\starting_equipment.sql
/* ──────────────────────────────────────────────
 * ROOT
 *
 * Intent:
 *   Represents the authored starting equipment
 *   definition for a system.
 *
 * Cardinality:
 *   systems 1 ──▶ 1 starting_equipment
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment (
  id uuid PRIMARY KEY,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.starting_equipment ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * SETS
 *
 * Intent:
 *   Top-level alternative sets of starting equipment.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment_sets (
  id uuid PRIMARY KEY,
  starting_equipment_id uuid NOT NULL
    REFERENCES public.starting_equipment(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_starting_equipment_sets_parent
  ON public.starting_equipment_sets(starting_equipment_id);

ALTER TABLE public.starting_equipment_sets ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * GROUPS
 *
 * Intent:
 *   Mutually-exclusive choice groups inside a set.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment_groups (
  id uuid PRIMARY KEY,
  equipment_set_id uuid NOT NULL
    REFERENCES public.starting_equipment_sets(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_starting_equipment_groups_set
  ON public.starting_equipment_groups(equipment_set_id);

ALTER TABLE public.starting_equipment_groups ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * OPTIONS
 *
 * Intent:
 *   Individual selectable options within a group.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment_options (
  id uuid PRIMARY KEY,
  equipment_group_id uuid NOT NULL
    REFERENCES public.starting_equipment_groups(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_starting_equipment_options_group
  ON public.starting_equipment_options(equipment_group_id);

ALTER TABLE public.starting_equipment_options ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * OPTION ITEMS
 *
 * Intent:
 *   Concrete equipment or currency payloads.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment_option_items (
  id uuid PRIMARY KEY,
  equipment_option_id uuid NOT NULL
    REFERENCES public.starting_equipment_options(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  starting_equipment_kind text NOT NULL,          -- EQUIPMENT | CURRENCY
  authoring_mode_kind text,                        -- ALL | SELECTED (EQUIPMENT only)
  selection_kind text,              -- CHOSEN | GRANTED (EQUIPMENT only)

  category_code text,                    -- EquipmentCategoryCode
  count integer,                    -- CHOSEN
  quantity integer,                 -- GRANTED

  sort_order integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT starting_equipment_option_items_kind_chk CHECK (
    starting_equipment_kind IN ('EQUIPMENT', 'CURRENCY')
  ),
  CONSTRAINT starting_equipment_option_items_equipment_payload_chk CHECK (
    (
      starting_equipment_kind = 'EQUIPMENT'
      AND authoring_mode_kind IN ('ALL', 'SELECTED')
      AND selection_kind IN ('CHOSEN', 'GRANTED')
    )
    OR (
      starting_equipment_kind = 'CURRENCY'
      AND authoring_mode_kind IS NULL
      AND selection_kind IS NULL
      AND category_code IS NULL
      AND count IS NULL
      AND quantity IS NULL
    )
  ),
  CONSTRAINT starting_equipment_option_items_selection_payload_chk CHECK (
    (
      selection_kind = 'CHOSEN'
      AND count IS NOT NULL
      AND quantity IS NULL
    )
    OR (
      selection_kind = 'GRANTED'
      AND quantity IS NOT NULL
      AND count IS NULL
    )
    OR selection_kind IS NULL
  ),
  CONSTRAINT starting_equipment_option_items_selected_mode_chk CHECK (
    authoring_mode_kind IN ('ALL', 'SELECTED')
  )
);

CREATE INDEX IF NOT EXISTS idx_starting_equipment_option_items_option
  ON public.starting_equipment_option_items(equipment_option_id);

ALTER TABLE public.starting_equipment_option_items ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * OPTION ITEM → EQUIPMENT IDS
 * (mode = SELECTED only)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment_option_item_equipment (
  option_item_id uuid NOT NULL
    REFERENCES public.starting_equipment_option_items(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  -- Deferred FK added in bootstrap/constraints/cross_domain_foreign_keys.sql
  equipment_id uuid NOT NULL,

  PRIMARY KEY (option_item_id, equipment_id)
);

ALTER TABLE public.starting_equipment_option_item_equipment ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * OPTION ITEM → PROPERTIES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment_option_item_properties (
  option_item_id uuid NOT NULL
    REFERENCES public.starting_equipment_option_items(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  property_code text NOT NULL,

  PRIMARY KEY (option_item_id, property_code)
);

ALTER TABLE public.starting_equipment_option_item_properties ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * OPTION ITEM → CURRENCY
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.starting_equipment_currencies (
  option_item_id uuid NOT NULL
    REFERENCES public.starting_equipment_option_items(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  currency_id uuid NOT NULL REFERENCES public.currencies(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  amount integer NOT NULL,

  PRIMARY KEY (option_item_id, currency_id)
);

ALTER TABLE public.starting_equipment_currencies ENABLE ROW LEVEL SECURITY;
-- END INCLUDE: src\domains\shared\tables\starting_equipment.sql
-- BEGIN INCLUDE: src\domains\effects\tables\effects.sql
/* ──────────────────────────────────────────────
 * EFFECTS
 * Root authored effect container
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.effects (
  id uuid PRIMARY KEY,

  -- Authoring order within parent container
  sort_order integer NOT NULL,

  -- No additional inline payload lives on the effect root.
  -- Nested invocation and moment trees are persisted in owned child tables.

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.effects ENABLE ROW LEVEL SECURITY;
-- END INCLUDE: src\domains\effects\tables\effects.sql
-- BEGIN INCLUDE: src\domains\effects\tables\conditions.sql
/* ──────────────────────────────────────────────
 * CONDITIONS — AUTHORED EFFECT ENTITY
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.conditions (
  id uuid PRIMARY KEY,

  condition_type_id uuid NOT NULL
    REFERENCES public.condition_types(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conditions_condition_type
  ON public.conditions(condition_type_id);

ALTER TABLE public.conditions ENABLE ROW LEVEL SECURITY;
-- END INCLUDE: src\domains\effects\tables\conditions.sql
-- BEGIN INCLUDE: src\domains\effects\tables\damages.sql
/*************************************************
 * DAMAGES — AUTHORED ENTITY (FINAL)
 * - Supports FIXED | DICE | POOL
 * - Supports ScalingType NONE | PER_LEVEL
 *   - PER_LEVEL levels only for FIXED/DICE
 *   - POOL PER_LEVEL uses scaling.value (not levels)
 * - Supports bonusCodes[] (author intent) + optional bonuses[] payloads
 *
 * Notes:
 * - Uses stale deletes for child tables to remain idempotent.
 * - Schema/bootstrap only. Application writes are handled later through Kysely.
 *************************************************/

-- =========================================================
-- TABLES
-- =========================================================

/* ──────────────────────────────────────────────
 * DAMAGES (ROOT)
 * ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.damages (
  id uuid PRIMARY KEY,

  damage_type_id uuid NOT NULL
    REFERENCES public.damage_types(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  value_kind text NOT NULL,        -- DAMAGE_VALUE_KIND: FIXED | DICE | POOL
  scaling_kind text NOT NULL,      -- SCALING_KIND: NONE | PER_LEVEL

  scaling_source text,             -- SCALING_SOURCE: CHARACTER_LEVEL | CLASS_LEVEL | SPELL_CAST_LEVEL
  class_id uuid,                   -- CLASS_LEVEL only; deferred FK added in bootstrap/constraints/cross_domain_foreign_keys.sql

  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_damages_damage_type
  ON public.damages(damage_type_id);

ALTER TABLE public.damages ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * DAMAGE BONUS KINDS (author intent)
 * ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.damage_bonus_kinds (
  damage_id uuid NOT NULL
    REFERENCES public.damages(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  bonus_kind text NOT NULL,        -- DAMAGE_BONUS_KIND
  sort_order integer NOT NULL DEFAULT 0,

  PRIMARY KEY (damage_id, bonus_kind)
);

CREATE INDEX IF NOT EXISTS idx_damage_bonus_kinds_damage
  ON public.damage_bonus_kinds(damage_id);
  
ALTER TABLE public.damage_bonus_kinds ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * DAMAGE VALUES (1:1 per damage)
 * Stores the resolved "value" object:
 * - FIXED: amount
 * - DICE: dice
 * - POOL: amount + optional multiplier/min/max
 *   (for POOL PER_LEVEL, these come from scaling.value)
 * ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.damage_values (
  id uuid PRIMARY KEY,
  damage_id uuid NOT NULL
    REFERENCES public.damages(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  -- FIXED / POOL
  amount numeric,

  -- DICE
  dice text,

  -- POOL scaling knobs
  multiplier numeric,
  min numeric,
  max numeric,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_damage_values_damage
  ON public.damage_values(damage_id);

ALTER TABLE public.damage_values ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * DAMAGE SCALING LEVELS (FIXED/DICE only)
 * Used when scaling_kind = PER_LEVEL and value_kind IN (FIXED, DICE)
 * ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.damage_scaling_levels (
  id uuid PRIMARY KEY,
  damage_id uuid NOT NULL
    REFERENCES public.damages(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  level integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,

  -- FIXED
  amount numeric,
  -- DICE
  dice text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT damage_scaling_shape_chk CHECK (
    (amount IS NOT NULL AND dice IS NULL)
    OR
    (dice IS NOT NULL AND amount IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_damage_scaling_levels_damage
  ON public.damage_scaling_levels(damage_id);
  
ALTER TABLE public.damage_scaling_levels ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * DAMAGE BONUSES (optional payload objects)
 * These are the "bonuses?: DamageBonusEffect[]" entries.
 * IMPORTANT:
 * - ability bonus stores AbilityCode as text in ability_code
 * - skill bonus references skill_id
 * - proficiency bonus has neither
 * ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.damage_bonuses (
  id uuid PRIMARY KEY,
  damage_id uuid NOT NULL
    REFERENCES public.damages(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  bonus_kind text NOT NULL,        -- DamageBonusCode

  ability_code text,               -- AbilityCode (ABILITY_BONUS only)
  skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,                   -- SKILL_BONUS only
  -- PROFICIENCY_BONUS has neither

  multiplier numeric,
  min numeric,
  max numeric,

  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_damage_bonuses_damage
  ON public.damage_bonuses(damage_id);

ALTER TABLE public.damage_bonuses ENABLE ROW LEVEL SECURITY;
-- END INCLUDE: src\domains\effects\tables\damages.sql
-- BEGIN INCLUDE: src\domains\effects\tables\invocations.sql
/* ──────────────────────────────────────────────
 * EFFECT INVOCATIONS — TABLE
 * One invocation per effect
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.effect_invocations (
  effect_id uuid PRIMARY KEY
    REFERENCES public.effects(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  trigger_code text NOT NULL,

  activation_type text NOT NULL,
  activation_value integer,

  range_characteristic_id uuid NOT NULL
    REFERENCES public.characteristics(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,

  shape_characteristic_id uuid
    REFERENCES public.characteristics(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,

  saving_throw_id uuid
    REFERENCES public.saving_throws(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_effect_invocations_trigger
  ON public.effect_invocations(trigger_code);

CREATE INDEX IF NOT EXISTS idx_effect_invocations_range
  ON public.effect_invocations(range_characteristic_id);

CREATE INDEX IF NOT EXISTS idx_effect_invocations_shape
  ON public.effect_invocations(shape_characteristic_id);

CREATE INDEX IF NOT EXISTS idx_effect_invocations_saving_throw
  ON public.effect_invocations(saving_throw_id);

ALTER TABLE public.effect_invocations ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * EFFECT INVOCATIONS — OWNERSHIP CLEANUP
 * ────────────────────────────────────────────── */

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_effect_invocations_owned'
      AND tgrelid = 'public.effect_invocations'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_effect_invocations_owned
      AFTER DELETE ON public.effect_invocations
      FOR EACH ROW
      EXECUTE FUNCTION public.cleanup_owned_rows('[
        { "table": "public.characteristics", "columns": ["range_characteristic_id", "shape_characteristic_id"] },
        { "table": "public.saving_throws", "columns": ["saving_throw_id"] }
      ]');
  END IF;
END;
$$;
-- END INCLUDE: src\domains\effects\tables\invocations.sql
-- BEGIN INCLUDE: src\domains\effects\tables\moments\moments.sql
/* ──────────────────────────────────────────────
 * MOMENTS — TABLES
 * NOTE:
 * - Moment containers do have authored IDs.
 * - We keep the authored id on the row, while also preserving the composite
 *   parent key shape that the existing payload tables already reference:
 *     (effect_id, trigger_code, moment_code)
 * - Payload is NOT stored here. Payload tables will FK to:
 *     - DIRECT: (effect_id, trigger_code, moment_code)
 *     - ROLL_TABLE: moment_roll_table_entries.id
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.effect_moments (
  id uuid NOT NULL UNIQUE,
  effect_id uuid NOT NULL REFERENCES public.effects(id) DEFERRABLE INITIALLY DEFERRED,
  trigger_code text NOT NULL,
  moment_code text NOT NULL,

  group_type text NOT NULL,
  resolution_kind text NOT NULL,

  -- Optional, only for DIRECT
  duration_id uuid REFERENCES public.characteristics(id) DEFERRABLE INITIALLY DEFERRED,

  -- Optional, only for ROLL_TABLE
  roll_table_kind text,
  die text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (effect_id, trigger_code, moment_code)
);

CREATE INDEX IF NOT EXISTS idx_effect_moments_effect_id
  ON public.effect_moments(effect_id);

CREATE INDEX IF NOT EXISTS idx_effect_moments_trigger_code
  ON public.effect_moments(trigger_code);

ALTER TABLE public.effect_moments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_effect_moments_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_effect_moments_owned_on_update
    AFTER UPDATE ON public.effect_moments
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[{
      "table": "public.characteristics",
      "columns": ["duration_id"]
    }]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_effect_moments_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_effect_moments_owned
    AFTER DELETE ON public.effect_moments
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.characteristics",
      "columns": ["duration_id"]
    }]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * MOMENT ROLL TABLE ENTRIES — TABLES
 * One row per authored roll-table entry (entry has an authored id)
 * Payload is NOT stored here; payload tables will FK to entry_id.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.moment_roll_table_entries (
  id uuid PRIMARY KEY,

  effect_id uuid NOT NULL REFERENCES public.effects(id) DEFERRABLE INITIALLY DEFERRED,
  trigger_code text NOT NULL,
  moment_code text NOT NULL,

  description text,
  sort_order integer NOT NULL,

  duration_id uuid REFERENCES public.characteristics(id) DEFERRABLE INITIALLY DEFERRED,

  -- EXACT table uses roll_value, RANGE table uses roll_min/roll_max
  roll_value integer,
  roll_min integer,
  roll_max integer,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT moment_roll_table_entry_parent_fk
    FOREIGN KEY (effect_id, trigger_code, moment_code)
    REFERENCES public.effect_moments(effect_id, trigger_code, moment_code)
    ON DELETE CASCADE,

  CONSTRAINT moment_roll_table_entry_roll_shape_chk CHECK (
    (roll_value IS NOT NULL AND roll_min IS NULL AND roll_max IS NULL)
    OR
    (roll_value IS NULL AND roll_min IS NOT NULL AND roll_max IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_moment_roll_table_entries_parent
  ON public.moment_roll_table_entries(effect_id, trigger_code, moment_code);

ALTER TABLE public.moment_roll_table_entries ENABLE ROW LEVEL SECURITY;
-- END INCLUDE: src\domains\effects\tables\moments\moments.sql
-- BEGIN INCLUDE: src\domains\effects\tables\moments\roll_tables.sql
/* ──────────────────────────────────────────────
 * MOMENT ROLL TABLE DAMAGE
 * One row per roll-table entry payload
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.moment_roll_table_damages (
  entry_id uuid PRIMARY KEY
    REFERENCES public.moment_roll_table_entries(id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  damage_id uuid NOT NULL
    REFERENCES public.damages(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_moment_roll_table_damages_damage_id
  ON public.moment_roll_table_damages(damage_id);

ALTER TABLE public.moment_roll_table_damages ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * MOMENT ROLL TABLE CONDITION
 * One row per roll-table entry payload
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.moment_roll_table_conditions (
  entry_id uuid PRIMARY KEY
    REFERENCES public.moment_roll_table_entries(id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  condition_id uuid NOT NULL
    REFERENCES public.conditions(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_moment_roll_table_conditions_condition_id
  ON public.moment_roll_table_conditions(condition_id);

ALTER TABLE public.moment_roll_table_conditions ENABLE ROW LEVEL SECURITY;
-- END INCLUDE: src\domains\effects\tables\moments\roll_tables.sql
-- BEGIN INCLUDE: src\domains\effects\tables\moments\direct.sql
/* ──────────────────────────────────────────────
 * MOMENT DIRECT DAMAGE
 * One row per DIRECT moment payload
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.moment_direct_damages (
  effect_id uuid NOT NULL REFERENCES public.effects(id) DEFERRABLE INITIALLY DEFERRED,
  trigger_code text NOT NULL,
  moment_code text NOT NULL,

  damage_id uuid NOT NULL
    REFERENCES public.damages(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (effect_id, trigger_code, moment_code),

  CONSTRAINT moment_direct_damage_fk
    FOREIGN KEY (effect_id, trigger_code, moment_code)
    REFERENCES public.effect_moments(effect_id, trigger_code, moment_code)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_moment_direct_damages_damage_id
  ON public.moment_direct_damages(damage_id);

ALTER TABLE public.moment_direct_damages ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * MOMENT DIRECT CONDITION
 * One row per DIRECT moment payload
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.moment_direct_conditions (
  effect_id uuid NOT NULL REFERENCES public.effects(id) DEFERRABLE INITIALLY DEFERRED,
  trigger_code text NOT NULL,
  moment_code text NOT NULL,

  condition_id uuid NOT NULL
    REFERENCES public.conditions(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  PRIMARY KEY (effect_id, trigger_code, moment_code),

  CONSTRAINT moment_direct_condition_fk
    FOREIGN KEY (effect_id, trigger_code, moment_code)
    REFERENCES public.effect_moments(effect_id, trigger_code, moment_code)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_moment_direct_conditions_condition_id
  ON public.moment_direct_conditions(condition_id);

ALTER TABLE public.moment_direct_conditions ENABLE ROW LEVEL SECURITY;
-- END INCLUDE: src\domains\effects\tables\moments\direct.sql
-- BEGIN INCLUDE: src\domains\features\tables\features.sql
/* ──────────────────────────────────────────────
* FEATURES — ROOT
*
* Intent:
*   A Feature is an authored container that groups
*   attributes, restrictions, effects, grants, and
*   selectable feature options.
*
*   Features may optionally expose Feature Options
*   gated by level via optionChoices.
*
* Cardinality:
*   systems 1 ──▶ N features
*
* Ownership:
*   features → attributes
*   features → restrictions (owned)
*   features → effects (owned)
*   features → <typed grant bridges>
*   features → feature_options (bridge)
*   features → feature_option_levels (owned)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  description text NOT NULL,
  detail text,
  charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,
  available_at_level integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_owned_on_update
    AFTER UPDATE ON public.features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_owned
    AFTER DELETE ON public.features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.feature_attributes (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  attribute_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, attribute_code)
);

CREATE INDEX IF NOT EXISTS idx_feature_attributes_feature ON public.feature_attributes (feature_id);

ALTER TABLE public.feature_attributes ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
* FEATURE — EFFECTS (OWNED)
*
* Intent:
*   Associates authored effects to the feature.
*
* Ownership:
*   feature_effects owns effect rows.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feature_effects (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  effect_id uuid NOT NULL REFERENCES public.effects (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, effect_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_effects_feature ON public.feature_effects (feature_id);

ALTER TABLE public.feature_effects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_effects_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_effects_owned
    AFTER DELETE ON public.feature_effects
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.effects",
      "columns": ["effect_id"]
    }]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEATURE — GRANT BRIDGES (TYPED)
*
* Intent:
*   Each grant kind has its own authored table.
*   These bridges attach grants to the feature.
*
* Ownership:
*   Bridges own grant rows.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feature_feat_grants (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  feat_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, feat_grant_id)
);

ALTER TABLE public.feature_feat_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_feat_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_feat_grants_owned
    AFTER DELETE ON public.feature_feat_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.feat_grants",
      "columns": ["feat_grant_id"]
    }]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.feature_modifier_grants (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  modifier_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, modifier_grant_id)
);

ALTER TABLE public.feature_modifier_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_modifier_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_modifier_grants_owned
    AFTER DELETE ON public.feature_modifier_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.modifier_grants",
      "columns": ["modifier_grant_id"]
    }]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.feature_proficiency_grants (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  proficiency_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, proficiency_grant_id)
);

ALTER TABLE public.feature_proficiency_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_proficiency_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_proficiency_grants_owned
    AFTER DELETE ON public.feature_proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.proficiency_grants",
      "columns": ["proficiency_grant_id"]
    }]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.feature_sense_grants (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sense_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, sense_grant_id)
);

ALTER TABLE public.feature_sense_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_sense_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_sense_grants_owned
    AFTER DELETE ON public.feature_sense_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.sense_grants",
      "columns": ["sense_grant_id"]
    }]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.feature_spell_grants (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  spell_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, spell_grant_id)
);

ALTER TABLE public.feature_spell_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feature_spell_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feature_spell_grants_owned
    AFTER DELETE ON public.feature_spell_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.spell_grants",
      "columns": ["spell_grant_id"]
    }]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEATURE — OPTIONS (BRIDGE)
*
* Intent:
*   Attaches selectable Feature Options to the feature.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feature_options (
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  option_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feature_id, option_id)
);

ALTER TABLE public.feature_options ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
* FEATURE — OPTIONS BY LEVEL (OWNED)
*
* Intent:
*   Defines how many options are selectable at
*   specific character levels.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feature_option_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  level integer NOT NULL,
  count integer NOT NULL,
  replace_count integer,
  sort_order integer NOT NULL
);

ALTER TABLE public.feature_option_levels ENABLE ROW LEVEL SECURITY;
-- END INCLUDE: src\domains\features\tables\features.sql
-- BEGIN INCLUDE: src\domains\features\tables\options.sql
/* ──────────────────────────────────────────────
* FEATURE OPTIONS — ROOT
*
* Intent:
*   A Feature Option is an authored feature-like container that can
*   carry attributes, restrictions, charges, effects, and grants.
*
*   This table represents the option itself; all child content is stored
*   in owned/authoritative child tables and bridge tables.
*
* Cardinality:
*   systems 1 ──▶ N options
*
* Ownership:
*   options → charges (1:1 owned via charge_id)
*   options → restrictions (owned via bridge)
*   options → effects (owned via bridge)
*   options → feat_grants (owned via bridge)
*   options → modifier_grants (owned via bridge)
*   options → proficiency_grants (owned via bridge)
*   options → sense_grants (owned via bridge)
*   options → spell_grants (owned via bridge)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  description text NOT NULL,
  detail text,
  sort_order integer NOT NULL,
  charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_options_charge ON public.options (charge_id);

ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_owned_on_update
    AFTER UPDATE ON public.options
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_owned
    AFTER DELETE ON public.options
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.option_attributes (
  option_id uuid NOT NULL REFERENCES public.options (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  attribute_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (option_id, attribute_code)
);

CREATE INDEX IF NOT EXISTS idx_option_attributes_option ON public.option_attributes (option_id);

ALTER TABLE public.option_attributes ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
* FEATURE OPTION — EFFECTS (OWNED)
*
* Intent:
*   Associates authored effects to the option (ordered).
*
* Cardinality:
*   options 1 ──▶ N option_effects
*
* Ownership:
*   option_effects owns effects rows.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.option_effects (
  option_id uuid NOT NULL REFERENCES public.options (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  effect_id uuid NOT NULL REFERENCES public.effects (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sort_order integer NOT NULL,
  PRIMARY KEY (option_id, effect_id)
);

ALTER TABLE public.option_effects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_option_effects_option ON public.option_effects (option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_effects_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_effects_owned
    AFTER DELETE ON public.option_effects
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.effects", "columns": ["effect_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEATURE OPTION — GRANTS (OWNED BRIDGES)
*
* Intent:
*   Each grant kind is stored in its own grant table; these bridges
*   attach grants to the option (ordered).
*
* Cardinality:
*   options 1 ──▶ N <bridge>
*
* Ownership:
*   Each bridge owns its grant rows.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.option_feat_grants (
  option_id uuid NOT NULL REFERENCES public.options (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  feat_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (option_id, feat_grant_id)
);

ALTER TABLE public.option_feat_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_option_feat_grants_option ON public.option_feat_grants (option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_feat_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_feat_grants_owned
    AFTER DELETE ON public.option_feat_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.feat_grants", "columns": ["feat_grant_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.option_modifier_grants (
  option_id uuid NOT NULL REFERENCES public.options (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  modifier_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (option_id, modifier_grant_id)
);

ALTER TABLE public.option_modifier_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_option_modifier_grants_option ON public.option_modifier_grants (option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_modifier_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_modifier_grants_owned
    AFTER DELETE ON public.option_modifier_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.modifier_grants", "columns": ["modifier_grant_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.option_proficiency_grants (
  option_id uuid NOT NULL REFERENCES public.options (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  proficiency_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (option_id, proficiency_grant_id)
);

ALTER TABLE public.option_proficiency_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_option_proficiency_grants_option ON public.option_proficiency_grants (option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_proficiency_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_proficiency_grants_owned
    AFTER DELETE ON public.option_proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.proficiency_grants", "columns": ["proficiency_grant_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.option_sense_grants (
  option_id uuid NOT NULL REFERENCES public.options (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sense_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (option_id, sense_grant_id)
);

ALTER TABLE public.option_sense_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_option_sense_grants_option ON public.option_sense_grants (option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_sense_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_sense_grants_owned
    AFTER DELETE ON public.option_sense_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.sense_grants", "columns": ["sense_grant_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.option_spell_grants (
  option_id uuid NOT NULL REFERENCES public.options (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  spell_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (option_id, spell_grant_id)
);

ALTER TABLE public.option_spell_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_option_spell_grants_option ON public.option_spell_grants (option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_option_spell_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_option_spell_grants_owned
    AFTER DELETE ON public.option_spell_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.spell_grants", "columns": ["spell_grant_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* OWNED CHILD CLEANUP: options → charges
*
* Intent:
*   charge_id is an owned FK. When the feature option is deleted,
*   delete the owned charge row.
*
*   When charge_id changes (or is cleared), delete the old owned row.
* ────────────────────────────────────────────── */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_options_charge_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_options_charge_owned
    AFTER DELETE ON public.options
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_options_charge_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_options_charge_owned_on_update
    AFTER UPDATE OF charge_id ON public.options
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] }
    ]');
  END IF;
END;
$$;
-- END INCLUDE: src\domains\features\tables\options.sql
-- BEGIN INCLUDE: src\domains\grants\tables\feats.sql
/* ──────────────────────────────────────────────
* FEAT GRANTS — ROOT
*
* Intent:
*   Authored grant that grants feats (ALL or SELECTED),
*   either directly or via per-level scaling.
*
* Cardinality:
*   systems 1 ──▶ N feat_grants
*
* Ownership:
*   feat_grants → feat_grant_charges     (owned rows in public.charges)
*   feat_grants → feat_grant_feats       (references feats; not owned entities)
*   feat_grants → feat_grant_scaling_levels
*   feat_grant_scaling_levels → feat_grant_scaling_level_feats
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /* base authored fields */
  sort_order integer NOT NULL,
  /* scaling discriminators */
  selection_kind text NOT NULL, -- AuthoringSelectionType (GRANTED | CHOSEN)
  scaling_kind text NOT NULL, -- ScalingType (NONE | PER_LEVEL)
  /* payload discriminator */
  authoring_mode_kind text NOT NULL, -- ALL | SELECTED
  /* CHOSEN (scaling NONE) only */
  selection_count integer, -- payload.count when CHOSEN + scaling NONE
  /* PER_LEVEL scaling source (only relevant when scaling_kind = PER_LEVEL) */
  scaling_source text, -- ScalingSource (CHARACTER_LEVEL | CLASS_LEVEL | SPELL_CAST_LEVEL)
  class_id uuid, -- CLASS_LEVEL
  charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feat_grants_root_sort_order_chk CHECK (
    sort_order > 0
  ),
  CONSTRAINT feat_grants_root_selection_kind_chk CHECK (
    selection_kind IN ('GRANTED', 'CHOSEN')
  ),
  CONSTRAINT feat_grants_root_scaling_kind_chk CHECK (
    scaling_kind IN ('NONE', 'PER_LEVEL')
  ),
  CONSTRAINT feat_grants_root_selection_count_chk CHECK (
    (scaling_kind <> 'NONE' AND selection_count IS NULL)
    OR (scaling_kind = 'NONE' AND selection_kind <> 'CHOSEN' AND selection_count IS NULL)
    OR (scaling_kind = 'NONE' AND selection_kind = 'CHOSEN' AND selection_count IS NOT NULL AND selection_count > 0)
  ),
  CONSTRAINT feat_grants_root_authoring_mode_chk CHECK (
    authoring_mode_kind IN ('ALL', 'SELECTED')
  ),
  CONSTRAINT feat_grants_root_scaling_source_chk CHECK (
    (scaling_kind = 'PER_LEVEL' AND scaling_source IN ('CHARACTER_LEVEL', 'CLASS_LEVEL', 'PARENT_CLASS_LEVEL', 'SPELL_CAST_LEVEL'))
    OR (scaling_kind = 'NONE' AND scaling_source IS NULL)
  ),
  CONSTRAINT feat_grants_root_scaling_class_chk CHECK (
    (scaling_source = 'CLASS_LEVEL' AND class_id IS NOT NULL)
    OR ((scaling_source IS NULL OR scaling_source <> 'CLASS_LEVEL') AND class_id IS NULL)
  ),
  CONSTRAINT feat_grants_root_mode_usage_chk CHECK (
    (scaling_kind = 'NONE' AND authoring_mode_kind IN ('ALL', 'SELECTED'))
    OR (scaling_kind = 'PER_LEVEL' AND authoring_mode_kind = 'ALL')
  )
);

ALTER TABLE public.feat_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_grant_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_grant_owned_on_update
    AFTER UPDATE ON public.feat_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_grant_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_grant_owned
    AFTER DELETE ON public.feat_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEAT GRANT — FEATS (ROOT PAYLOAD, SELECTED ONLY)
*
* Intent:
*   Stores payload.featIds when authoring_mode_kind = SELECTED
*   AND scaling_kind = NONE (root payload).
*
* Cardinality:
*   feat_grants 1 ──▶ N feats
*
* Ownership:
*   rows are owned by feat_grants, feats are not owned.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_grant_feats (
  feat_grant_id uuid NOT NULL REFERENCES public.feat_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  feat_id uuid NOT NULL,
  PRIMARY KEY (feat_grant_id, feat_id)
);

ALTER TABLE public.feat_grant_feats ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_grant_feats_grant ON public.feat_grant_feats (feat_grant_id);

CREATE INDEX IF NOT EXISTS idx_feat_grant_feats_feat ON public.feat_grant_feats (feat_id);

/* ──────────────────────────────────────────────
* FEAT GRANT — SCALING LEVELS (PER_LEVEL)
*
* Intent:
*   Stores scaling.levels[] rows.
*   Each level stores its own payload mode and optional count (CHOSEN).
*
* Cardinality:
*   feat_grants 1 ──▶ N scaling levels
*
* Ownership:
*   owned by feat_grants.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_grant_scaling_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feat_grant_id uuid NOT NULL REFERENCES public.feat_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  level integer NOT NULL,
  sort_order integer NOT NULL,
  authoring_mode_kind text NOT NULL, -- ALL | SELECTED (per-level payload)
  selection_count integer, -- value.count when selection_kind = CHOSEN (per-level)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feat_grant_scaling_levels_level_chk CHECK (
    level > 0
  ),
  CONSTRAINT feat_grant_scaling_levels_sort_order_chk CHECK (
    sort_order > 0
  ),
  CONSTRAINT feat_grant_scaling_levels_mode_chk CHECK (
    authoring_mode_kind IN ('ALL', 'SELECTED')
  ),
  CONSTRAINT feat_grant_scaling_levels_selection_count_chk CHECK (
    selection_count IS NULL OR selection_count > 0
  )
);

ALTER TABLE public.feat_grant_scaling_levels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_grant_scaling_levels_grant ON public.feat_grant_scaling_levels (feat_grant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_feat_grant_scaling_levels_grant_level
  ON public.feat_grant_scaling_levels (feat_grant_id, level);

/* ──────────────────────────────────────────────
* FEAT GRANT — SCALING LEVEL FEATS (SELECTED ONLY)
*
* Intent:
*   Stores level.value.featIds when authoring_mode_kind = SELECTED
*   for a given scaling level.
*
* Cardinality:
*   scaling_levels 1 ──▶ N feats
*
* Ownership:
*   rows owned by scaling_levels, feats are not owned.
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_grant_scaling_level_feats (
  scaling_level_id uuid NOT NULL REFERENCES public.feat_grant_scaling_levels (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  feat_id uuid NOT NULL,
  PRIMARY KEY (scaling_level_id, feat_id)
);

ALTER TABLE public.feat_grant_scaling_level_feats ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_grant_scaling_level_feats_level ON public.feat_grant_scaling_level_feats (scaling_level_id);
-- END INCLUDE: src\domains\grants\tables\feats.sql
-- BEGIN INCLUDE: src\domains\grants\tables\modifiers.sql
/* ============================================================================
 * MODIFIER GRANTS
 *
 * Normalization notes:
 * - modifier_grants stores authored root metadata and the single owned
 *   restriction subtree reference.
 * - modifier_grant_domain_params stores the finite set of domain-correlated
 *   selector params (ability, skill, attack domain, spell level, etc.).
 * - modifier_grant_payloads stores the 1:1 payload surface with concrete
 *   columns named after the authored payload fields.
 * - modifier_grant_charge_levels stores the owned level rows for
 *   MODIFY_CHARGE_LIMIT payloads that use PER_LEVEL scaling.
 * ========================================================================= */

CREATE TABLE IF NOT EXISTS public.modifier_grants (
  id uuid PRIMARY KEY,
  system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  grant_kind text NOT NULL DEFAULT 'MODIFIER_GRANT',
  value_domain_code text NOT NULL,
  modifier_kind text NOT NULL,
  scope text NOT NULL,
  selection_kind text NOT NULL,
  count integer,
  sort_order integer NOT NULL,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modifier_grants_count_chk CHECK (
    (selection_kind <> 'CHOSEN' AND count IS NULL)
    OR (selection_kind = 'CHOSEN' AND count IS NOT NULL AND count > 0)
  )
);

ALTER TABLE public.modifier_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grants_system ON public.modifier_grants (system_id);
CREATE INDEX IF NOT EXISTS idx_modifier_grants_value_domain ON public.modifier_grants (value_domain_code);
CREATE INDEX IF NOT EXISTS idx_modifier_grants_kind ON public.modifier_grants (modifier_kind);
CREATE INDEX IF NOT EXISTS idx_modifier_grants_scope ON public.modifier_grants (scope);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_modifier_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_modifier_owned_on_update
    AFTER UPDATE ON public.modifier_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_modifier_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_modifier_owned
    AFTER DELETE ON public.modifier_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.modifier_grant_domain_params (
  modifier_grant_id uuid PRIMARY KEY REFERENCES public.modifier_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  value_domain_code text NOT NULL,
  attack_domain_code text,
  ability_code text,
  skill_id uuid REFERENCES public.skills (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  speed_id uuid REFERENCES public.speeds (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  sense_code text,
  spell_level integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modifier_grant_domain_params_spell_level_chk CHECK (
    spell_level IS NULL OR (spell_level >= 0 AND spell_level <= 9)
  )
);

ALTER TABLE public.modifier_grant_domain_params ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grant_domain_params_domain ON public.modifier_grant_domain_params (value_domain_code);
CREATE INDEX IF NOT EXISTS idx_modifier_grant_domain_params_skill ON public.modifier_grant_domain_params (skill_id);
CREATE INDEX IF NOT EXISTS idx_modifier_grant_domain_params_speed ON public.modifier_grant_domain_params (speed_id);

CREATE TABLE IF NOT EXISTS public.modifier_grant_payloads (
  modifier_grant_id uuid PRIMARY KEY REFERENCES public.modifier_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  modifier_kind text NOT NULL,
  value_domain_code text NOT NULL,
  numeric_value_kind text,
  numeric_amount numeric,
  numeric_multiplier numeric,
  numeric_ability_code text,
  numeric_skill_id uuid REFERENCES public.skills (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  numeric_class_id uuid,
  set_amount numeric,
  charge_limit_kind text,
  charge_scaling_kind text,
  charge_amount integer,
  charge_multiplier numeric,
  charge_min integer,
  charge_max integer,
  dice text,
  damage_type_id uuid REFERENCES public.damage_types (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  condition_type_id uuid REFERENCES public.condition_types (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  movement_mode_id text,
  attribute_id text,
  range_kind text,
  duration_kind text,
  shape_kind text,
  reset_kind text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modifier_grant_payloads_numeric_value_kind_chk CHECK (
    numeric_value_kind IS NULL OR numeric_value_kind <> ''
  ),
  CONSTRAINT modifier_grant_payloads_dice_chk CHECK (
    dice IS NULL OR dice <> ''
  ),
  CONSTRAINT modifier_grant_payloads_charge_fixed_amount_chk CHECK (
    charge_limit_kind IS DISTINCT FROM 'FIXED_AMOUNT'
    OR (
      (charge_scaling_kind = 'NONE' AND charge_amount IS NOT NULL AND charge_multiplier IS NULL AND charge_min IS NULL AND charge_max IS NULL)
      OR
      (charge_scaling_kind = 'PER_LEVEL' AND charge_amount IS NULL)
    )
  ),
  CONSTRAINT modifier_grant_payloads_charge_level_scaled_chk CHECK (
    charge_limit_kind IS DISTINCT FROM 'CHARACTER_LEVEL'
    AND charge_limit_kind IS DISTINCT FROM 'CLASS_LEVEL'
    AND charge_limit_kind IS DISTINCT FROM 'PARENT_CLASS_LEVEL'
    AND charge_limit_kind IS DISTINCT FROM 'SPELL_CAST_LEVEL'
    OR (
      charge_scaling_kind = 'NONE'
      AND charge_amount IS NULL
    )
  )
);

ALTER TABLE public.modifier_grant_payloads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_kind ON public.modifier_grant_payloads (modifier_kind);
CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_domain ON public.modifier_grant_payloads (value_domain_code);
CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_value_kind ON public.modifier_grant_payloads (numeric_value_kind);
CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_damage_type ON public.modifier_grant_payloads (damage_type_id);
CREATE INDEX IF NOT EXISTS idx_modifier_grant_payloads_condition_type ON public.modifier_grant_payloads (condition_type_id);

CREATE TABLE IF NOT EXISTS public.modifier_grant_charge_levels (
  id uuid PRIMARY KEY,
  modifier_grant_id uuid NOT NULL REFERENCES public.modifier_grant_payloads (modifier_grant_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  level integer NOT NULL,
  amount integer NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modifier_grant_charge_levels_level_chk CHECK (level > 0)
);

ALTER TABLE public.modifier_grant_charge_levels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grant_charge_levels_grant ON public.modifier_grant_charge_levels (modifier_grant_id);

CREATE TABLE IF NOT EXISTS public.modifier_grant_optional_abilities (
  modifier_grant_id uuid NOT NULL REFERENCES public.modifier_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  ability_code text NOT NULL,
  PRIMARY KEY (modifier_grant_id, ability_code)
);

ALTER TABLE public.modifier_grant_optional_abilities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modifier_grant_optional_abilities_grant ON public.modifier_grant_optional_abilities (modifier_grant_id);
-- END INCLUDE: src\domains\grants\tables\modifiers.sql
-- BEGIN INCLUDE: src\domains\grants\tables\proficiencies.sql
/* ============================================================================
 * PROFICIENCY GRANTS
 *
 * Normalization notes:
 * - proficiency_grants stores the authored root metadata plus the single owned
 *   restriction subtree reference.
 * - payload surfaces stay explicit by proficiency kind instead of collapsing
 *   into generic value columns.
 * - equipment-related optional category/property filters are stored in their
 *   own small owned tables because they are not the same concept as granted
 *   equipment ids.
 * ========================================================================= */

CREATE TABLE IF NOT EXISTS public.proficiency_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_kind text NOT NULL DEFAULT 'PROFICIENCY_GRANT',
  sort_order integer NOT NULL,
  proficiency_kind text NOT NULL,
  selection_kind text NOT NULL,
  authoring_mode_kind text NOT NULL, -- ALL | SELECTED
  count integer,
  level text NOT NULL,
  rounding text,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proficiency_grants_count_chk CHECK (
    (selection_kind <> 'CHOSEN' AND count IS NULL)
    OR (selection_kind = 'CHOSEN' AND count IS NOT NULL AND count > 0)
  ),
  CONSTRAINT proficiency_grants_authoring_mode_chk CHECK (
    authoring_mode_kind IN ('ALL', 'SELECTED')
  ),
  CONSTRAINT proficiency_grants_rounding_chk CHECK (
    (level = 'HALF' AND rounding IS NOT NULL)
    OR (level <> 'HALF' AND rounding IS NULL)
  )
);

ALTER TABLE public.proficiency_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_proficiency_grants_kind ON public.proficiency_grants (proficiency_kind);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_proficiency_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_proficiency_grants_owned
    AFTER DELETE ON public.proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_proficiency_grants_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_proficiency_grants_owned_on_update
    AFTER UPDATE ON public.proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_skills (
  proficiency_grant_id uuid NOT NULL REFERENCES public.proficiency_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  skill_id uuid NOT NULL REFERENCES public.skills (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (proficiency_grant_id, skill_id)
);

ALTER TABLE public.proficiency_grant_skills ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_save_abilities (
  proficiency_grant_id uuid NOT NULL REFERENCES public.proficiency_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  ability_code text NOT NULL,
  PRIMARY KEY (proficiency_grant_id, ability_code)
);

ALTER TABLE public.proficiency_grant_save_abilities ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_languages (
  proficiency_grant_id uuid NOT NULL REFERENCES public.proficiency_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  language_id uuid NOT NULL REFERENCES public.languages (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (proficiency_grant_id, language_id)
);

ALTER TABLE public.proficiency_grant_languages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_equipment (
  proficiency_grant_id uuid NOT NULL REFERENCES public.proficiency_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  equipment_id uuid NOT NULL,
  PRIMARY KEY (proficiency_grant_id, equipment_id)
);

ALTER TABLE public.proficiency_grant_equipment ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_equipment_filters (
  proficiency_grant_id uuid PRIMARY KEY REFERENCES public.proficiency_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  category_code text
);

ALTER TABLE public.proficiency_grant_equipment_filters ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_equipment_filter_properties (
  proficiency_grant_id uuid NOT NULL REFERENCES public.proficiency_grant_equipment_filters (proficiency_grant_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  property_code text NOT NULL,
  PRIMARY KEY (proficiency_grant_id, property_code)
);

ALTER TABLE public.proficiency_grant_equipment_filter_properties ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_equipment_properties (
  proficiency_grant_id uuid NOT NULL REFERENCES public.proficiency_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  property_code text NOT NULL,
  PRIMARY KEY (proficiency_grant_id, property_code)
);

ALTER TABLE public.proficiency_grant_equipment_properties ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proficiency_grant_equipment_property_filters (
  proficiency_grant_id uuid PRIMARY KEY REFERENCES public.proficiency_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  category_code text
);

ALTER TABLE public.proficiency_grant_equipment_property_filters ENABLE ROW LEVEL SECURITY;
-- END INCLUDE: src\domains\grants\tables\proficiencies.sql
-- BEGIN INCLUDE: src\domains\grants\tables\senses.sql
/* ──────────────────────────────────────────────
* SENSE GRANTS — ROOT
*
* Intent:
*   Authored grant that grants senses (ALL or SELECTED),
*   either directly or via per-level scaling.
*
* Cardinality:
*   systems 1 ──▶ N sense_grants
*
* Ownership:
*   sense_grants → sense_grant_restrictions (owned restrictions)
*   sense_grants → sense_grant_charges     (owned charges, optional 1:1)
*   sense_grants → sense_grant_senses      (sense references)
*   sense_grants → sense_grant_scaling_levels
*   sense_grant_scaling_levels → sense_grant_scaling_level_senses
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.sense_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order integer NOT NULL,
  selection_kind text NOT NULL, -- GRANTED | CHOSEN
  scaling_kind text NOT NULL, -- NONE | PER_LEVEL
  authoring_mode_kind text NOT NULL, -- ALL | SELECTED
  selection_count integer, -- CHOSEN + NONE only
  scaling_source text, -- SCALING_SOURCE (CHARACTER_LEVEL | CLASS_LEVEL | SPELL_CAST_LEVEL)
  class_id uuid,
  charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sense_grants_root_sort_order_chk CHECK (
    sort_order > 0
  ),
  CONSTRAINT sense_grants_root_selection_kind_chk CHECK (
    selection_kind IN ('GRANTED', 'CHOSEN')
  ),
  CONSTRAINT sense_grants_root_scaling_kind_chk CHECK (
    scaling_kind IN ('NONE', 'PER_LEVEL')
  ),
  CONSTRAINT sense_grants_root_selection_count_chk CHECK (
    (scaling_kind <> 'NONE' AND selection_count IS NULL)
    OR (scaling_kind = 'NONE' AND selection_kind <> 'CHOSEN' AND selection_count IS NULL)
    OR (scaling_kind = 'NONE' AND selection_kind = 'CHOSEN' AND selection_count IS NOT NULL AND selection_count > 0)
  ),
  CONSTRAINT sense_grants_root_authoring_mode_chk CHECK (
    authoring_mode_kind IN ('ALL', 'SELECTED')
  ),
  CONSTRAINT sense_grants_root_scaling_source_chk CHECK (
    (scaling_kind = 'PER_LEVEL' AND scaling_source IN ('CHARACTER_LEVEL', 'CLASS_LEVEL', 'PARENT_CLASS_LEVEL', 'SPELL_CAST_LEVEL'))
    OR (scaling_kind = 'NONE' AND scaling_source IS NULL)
  ),
  CONSTRAINT sense_grants_root_scaling_class_chk CHECK (
    (scaling_source = 'CLASS_LEVEL' AND class_id IS NOT NULL)
    OR ((scaling_source IS NULL OR scaling_source <> 'CLASS_LEVEL') AND class_id IS NULL)
  ),
  CONSTRAINT sense_grants_root_mode_usage_chk CHECK (
    (scaling_kind = 'NONE' AND authoring_mode_kind IN ('ALL', 'SELECTED'))
    OR (scaling_kind = 'PER_LEVEL' AND authoring_mode_kind = 'ALL')
  )
);

ALTER TABLE public.sense_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_sense_grant_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_sense_grant_owned
    AFTER DELETE ON public.sense_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_sense_grant_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_sense_grant_owned_on_update
    AFTER UPDATE ON public.sense_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* SENSE GRANT — ROOT PAYLOAD (SELECTED, NONE)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.sense_grant_senses (
  sense_grant_id uuid NOT NULL REFERENCES public.sense_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sense_id uuid NOT NULL REFERENCES public.senses (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (sense_grant_id, sense_id)
);

ALTER TABLE public.sense_grant_senses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sense_grant_senses_grant ON public.sense_grant_senses (sense_grant_id);

/* ──────────────────────────────────────────────
* SENSE GRANT — SCALING LEVELS
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.sense_grant_scaling_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sense_grant_id uuid NOT NULL REFERENCES public.sense_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  level integer NOT NULL,
  sort_order integer NOT NULL,
  authoring_mode_kind text NOT NULL, -- ALL | SELECTED
  selection_count integer, -- CHOSEN per-level
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sense_grant_scaling_levels_level_chk CHECK (
    level > 0
  ),
  CONSTRAINT sense_grant_scaling_levels_sort_order_chk CHECK (
    sort_order > 0
  ),
  CONSTRAINT sense_grant_scaling_levels_mode_chk CHECK (
    authoring_mode_kind IN ('ALL', 'SELECTED')
  ),
  CONSTRAINT sense_grant_scaling_levels_selection_count_chk CHECK (
    selection_count IS NULL OR selection_count > 0
  )
);

ALTER TABLE public.sense_grant_scaling_levels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sense_grant_scaling_levels_grant ON public.sense_grant_scaling_levels (sense_grant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sense_grant_scaling_levels_grant_level
  ON public.sense_grant_scaling_levels (sense_grant_id, level);

/* ──────────────────────────────────────────────
* SENSE GRANT — SCALING LEVEL PAYLOAD
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.sense_grant_scaling_level_senses (
  scaling_level_id uuid NOT NULL REFERENCES public.sense_grant_scaling_levels (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sense_id uuid NOT NULL REFERENCES public.senses (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (scaling_level_id, sense_id)
);

ALTER TABLE public.sense_grant_scaling_level_senses ENABLE ROW LEVEL SECURITY;
-- END INCLUDE: src\domains\grants\tables\senses.sql
-- BEGIN INCLUDE: src\domains\grants\tables\spells.sql
/* ──────────────────────────────────────────────
* SPELL GRANTS — ROOT
*
* Intent:
*   Authored grant that grants spells (ALL or SELECTED),
*   optionally scaled per level, optionally with filters
*   and optional charges.
*
* Cardinality:
*   systems 1 ──▶ N spell_grants
*
* Ownership:
*   spell_grants → spell_grant_restrictions
*   spell_grants → spell_grant_filters
*   spell_grants → spell_grant_charges
*   spell_grants → spell_grant_attributes
*   spell_grants → spell_grant_spells
*   spell_grants → spell_grant_scaling_levels
*   spell_grant_scaling_levels → spell_grant_scaling_level_spells
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.spell_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order integer NOT NULL,
  selection_kind text NOT NULL, -- GRANTED | CHOSEN
  scaling_kind text NOT NULL, -- NONE | PER_LEVEL
  authoring_mode_kind text NOT NULL, -- ALL | SELECTED
  selection_count integer, -- CHOSEN + NONE only
  scaling_source text, -- ScalingSource (CHARACTER_LEVEL | CLASS_LEVEL | SPELL_CAST_LEVEL)
  class_id uuid,
  charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  filter_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  cast_at_level integer, -- optional override
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spell_grants_root_sort_order_chk CHECK (
    sort_order > 0
  ),
  CONSTRAINT spell_grants_root_selection_kind_chk CHECK (
    selection_kind IN ('GRANTED', 'CHOSEN')
  ),
  CONSTRAINT spell_grants_root_scaling_kind_chk CHECK (
    scaling_kind IN ('NONE', 'PER_LEVEL')
  ),
  CONSTRAINT spell_grants_root_selection_count_chk CHECK (
    (scaling_kind <> 'NONE' AND selection_count IS NULL)
    OR (scaling_kind = 'NONE' AND selection_kind <> 'CHOSEN' AND selection_count IS NULL)
    OR (scaling_kind = 'NONE' AND selection_kind = 'CHOSEN' AND selection_count IS NOT NULL AND selection_count > 0)
  ),
  CONSTRAINT spell_grants_root_authoring_mode_chk CHECK (
    authoring_mode_kind IN ('ALL', 'SELECTED')
  ),
  CONSTRAINT spell_grants_root_scaling_source_chk CHECK (
    (scaling_kind = 'PER_LEVEL' AND scaling_source IN ('CHARACTER_LEVEL', 'CLASS_LEVEL', 'PARENT_CLASS_LEVEL', 'SPELL_CAST_LEVEL'))
    OR (scaling_kind = 'NONE' AND scaling_source IS NULL)
  ),
  CONSTRAINT spell_grants_root_scaling_class_chk CHECK (
    (scaling_source = 'CLASS_LEVEL' AND class_id IS NOT NULL)
    OR ((scaling_source IS NULL OR scaling_source <> 'CLASS_LEVEL') AND class_id IS NULL)
  ),
  CONSTRAINT spell_grants_root_mode_usage_chk CHECK (
    (scaling_kind = 'NONE' AND authoring_mode_kind IN ('ALL', 'SELECTED'))
    OR (scaling_kind = 'PER_LEVEL' AND authoring_mode_kind = 'ALL')
  ),
  CONSTRAINT spell_grants_root_cast_at_level_chk CHECK (
    cast_at_level IS NULL OR cast_at_level > 0
  )
);

ALTER TABLE public.spell_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_spell_grant_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_spell_grant_owned_on_update
    AFTER UPDATE ON public.spell_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id", "filter_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_spell_grant_restrictions_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_spell_grant_restrictions_owned
    AFTER DELETE ON public.spell_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id", "filter_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* SPELL GRANT — ATTRIBUTES
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.spell_grant_attributes (
  spell_grant_id uuid NOT NULL REFERENCES public.spell_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  attribute_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (spell_grant_id, attribute_code),
  CONSTRAINT spell_grant_attributes_code_chk CHECK (
    attribute_code IN (
      'CONCENTRATION',
      'RITUAL',
      'LIMITED_USE',
      'PREPARED',
      'KNOWN',
      'CAST_AT_WILL',
      'CAST_AT_LEVEL',
      'SELF_ONLY'
    )
  ),
  CONSTRAINT spell_grant_attributes_sort_order_chk CHECK (
    sort_order > 0
  )
);

ALTER TABLE public.spell_grant_attributes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_spell_grant_attributes_grant ON public.spell_grant_attributes (spell_grant_id);

/* ──────────────────────────────────────────────
* SPELL GRANT — ROOT PAYLOAD (NONE)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.spell_grant_spells (
  spell_grant_id uuid NOT NULL REFERENCES public.spell_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  spell_id uuid NOT NULL,
  PRIMARY KEY (spell_grant_id, spell_id)
);

ALTER TABLE public.spell_grant_spells ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_spell_grant_spells_grant ON public.spell_grant_spells (spell_grant_id);

/* ──────────────────────────────────────────────
* SPELL GRANT — SCALING LEVELS
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.spell_grant_scaling_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spell_grant_id uuid NOT NULL REFERENCES public.spell_grants (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  level integer NOT NULL,
  sort_order integer NOT NULL,
  authoring_mode_kind text NOT NULL, -- ALL | SELECTED
  selection_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spell_grant_scaling_levels_level_chk CHECK (
    level > 0
  ),
  CONSTRAINT spell_grant_scaling_levels_sort_order_chk CHECK (
    sort_order > 0
  ),
  CONSTRAINT spell_grant_scaling_levels_mode_chk CHECK (
    authoring_mode_kind IN ('ALL', 'SELECTED')
  ),
  CONSTRAINT spell_grant_scaling_levels_selection_count_chk CHECK (
    selection_count IS NULL OR selection_count > 0
  )
);

ALTER TABLE public.spell_grant_scaling_levels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_spell_grant_scaling_levels_grant ON public.spell_grant_scaling_levels (spell_grant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_spell_grant_scaling_levels_grant_level
  ON public.spell_grant_scaling_levels (spell_grant_id, level);

/* ──────────────────────────────────────────────
* SPELL GRANT — SCALING LEVEL PAYLOAD
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.spell_grant_scaling_level_spells (
  scaling_level_id uuid NOT NULL REFERENCES public.spell_grant_scaling_levels (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  spell_id uuid NOT NULL,
  PRIMARY KEY (scaling_level_id, spell_id)
);

ALTER TABLE public.spell_grant_scaling_level_spells ENABLE ROW LEVEL SECURITY;
-- END INCLUDE: src\domains\grants\tables\spells.sql
-- BEGIN INCLUDE: src\domains\subjects\tables\backgrounds.sql
/* ──────────────────────────────────────────────
 * BACKGROUNDS — ROOT
 *
 * Intent:
 *   Background is a top-level authored subject that can grant
 *   proficiencies, features, starting equipment, and details.
 *
 * Cardinality:
 *   systems 1 ──▶ N backgrounds
 *
 * Ownership:
 *   backgrounds → details (owned via bridge)
 *   backgrounds → starting_equipment (owned 1:1 via FK)
 *   backgrounds → proficiency_grants (owned via bridge)
 *   backgrounds → features (owned via bridge)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.backgrounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  description text,

  starting_equipment_id uuid
    REFERENCES public.starting_equipment(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  is_master boolean,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.backgrounds ENABLE ROW LEVEL SECURITY;

SELECT public.apply_system_derived_policies('backgrounds');

CREATE INDEX IF NOT EXISTS idx_backgrounds_system
  ON public.backgrounds(system_id);

CREATE INDEX IF NOT EXISTS idx_backgrounds_user
  ON public.backgrounds(user_id);

CREATE INDEX IF NOT EXISTS idx_backgrounds_starting_equipment
  ON public.backgrounds(starting_equipment_id);

/* ──────────────────────────────────────────────
 * BACKGROUND — DETAILS (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.background_details (
  background_id uuid NOT NULL
    REFERENCES public.backgrounds(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  detail_id uuid NOT NULL
    REFERENCES public.details(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  PRIMARY KEY (background_id, detail_id)
);

ALTER TABLE background_details ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_background_details_background
  ON public.background_details(background_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_background_details_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_background_details_owned
    AFTER DELETE ON public.background_details
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.details", "columns": ["detail_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * BACKGROUND — PROFICIENCY GRANTS (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.background_proficiency_grants (
  background_id uuid NOT NULL
    REFERENCES public.backgrounds(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  proficiency_grant_id uuid NOT NULL,

  sort_order integer NOT NULL,

  PRIMARY KEY (background_id, proficiency_grant_id)
);

ALTER TABLE public.background_proficiency_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_background_proficiency_grants_background
  ON public.background_proficiency_grants(background_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_background_proficiency_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_background_proficiency_grants_owned
    AFTER DELETE ON public.background_proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.proficiency_grants", "columns": ["proficiency_grant_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * BACKGROUND — FEATURES (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.background_features (
  background_id uuid NOT NULL
    REFERENCES public.backgrounds(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  feature_id uuid NOT NULL,

  sort_order integer NOT NULL,

  PRIMARY KEY (background_id, feature_id)
);

ALTER TABLE public.background_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_background_features_background
  ON public.background_features(background_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_background_features_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_background_features_owned
    AFTER DELETE ON public.background_features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.features", "columns": ["feature_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * BACKGROUND → STARTING EQUIPMENT (OWNED)
 * ────────────────────────────────────────────── */

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_background_starting_equipment_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_background_starting_equipment_owned
    AFTER DELETE ON public.backgrounds
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.starting_equipment", "columns": ["starting_equipment_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_background_starting_equipment_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_background_starting_equipment_owned_on_update
    AFTER UPDATE OF starting_equipment_id ON public.backgrounds
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.starting_equipment", "columns": ["starting_equipment_id"] }
    ]');
  END IF;
END;
$$;
-- END INCLUDE: src\domains\subjects\tables\backgrounds.sql
-- BEGIN INCLUDE: src\domains\subjects\tables\characters.sql
/* ──────────────────────────────────────────────
 * CHARACTERS
 *
 * User-authored character persistence.
 * Characters are always user-owned and never master data.
 * ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE,
  label text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_characters_system_id ON public.characters (system_id);

CREATE INDEX IF NOT EXISTS idx_characters_user_id ON public.characters (user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_characters_updated_at'
      AND tgrelid = 'public.characters'::regclass) THEN
  CREATE TRIGGER trg_characters_updated_at
    BEFORE UPDATE ON public.characters
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.characters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Character owners can read" ON public.characters;
CREATE POLICY "Character owners can read"
  ON public.characters FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt()::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Character owners can insert" ON public.characters;
CREATE POLICY "Character owners can insert"
  ON public.characters FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR (auth.jwt()::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Character owners can update" ON public.characters;
CREATE POLICY "Character owners can update"
  ON public.characters FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt()::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (auth.jwt()::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Character owners can delete" ON public.characters;
CREATE POLICY "Character owners can delete"
  ON public.characters FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt()::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

CREATE TABLE IF NOT EXISTS public.character_advancement (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  method_code text NOT NULL,
  experience integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_advancement_method_chk CHECK (
    method_code IN ('EXPERIENCE', 'MILESTONE')
  ),
  CONSTRAINT character_advancement_experience_chk CHECK (
    (method_code = 'MILESTONE' AND experience IS NULL)
    OR (method_code = 'EXPERIENCE' AND (experience IS NULL OR experience >= 0))
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_advancement_updated_at'
      AND tgrelid = 'public.character_advancement'::regclass) THEN
  CREATE TRIGGER trg_character_advancement_updated_at
    BEFORE UPDATE ON public.character_advancement
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_advancement ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_race (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  race_id uuid NOT NULL REFERENCES public.races (id) ON DELETE CASCADE DEFERRABLE,
  subrace_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_char_race_race_id ON public.character_race (race_id);

CREATE INDEX IF NOT EXISTS idx_char_race_subrace_id ON public.character_race (subrace_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_race_updated_at'
      AND tgrelid = 'public.character_race'::regclass) THEN
  CREATE TRIGGER trg_character_race_updated_at
    BEFORE UPDATE ON public.character_race
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_race ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_background (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  background_id uuid NOT NULL REFERENCES public.backgrounds (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_char_background_background_id ON public.character_background (background_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_background_updated_at'
      AND tgrelid = 'public.character_background'::regclass) THEN
  CREATE TRIGGER trg_character_background_updated_at
    BEFORE UPDATE ON public.character_background
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_background ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_ancestry_acquisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  ancestry_id uuid NOT NULL REFERENCES public.race_ancestries (id) ON DELETE CASCADE DEFERRABLE,
  option_id uuid NOT NULL REFERENCES public.race_ancestry_options (id) ON DELETE CASCADE DEFERRABLE,
  source_kind text NOT NULL,
  race_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  subrace_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  timing_kind text NOT NULL,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  class_level integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_ancestry_source_kind_chk CHECK (
    source_kind IN ('RACE', 'SUBRACE')
  ),
  CONSTRAINT character_ancestry_source_ref_chk CHECK (
    ((race_id IS NOT NULL)::int + (subrace_id IS NOT NULL)::int) = 1
  ),
  CONSTRAINT character_ancestry_timing_kind_chk CHECK (
    timing_kind IN ('IMMEDIATE', 'CLASS_LEVEL')
  ),
  CONSTRAINT character_ancestry_class_level_chk CHECK (
    (timing_kind = 'CLASS_LEVEL' AND class_id IS NOT NULL AND class_level IS NOT NULL)
    OR (timing_kind = 'IMMEDIATE' AND class_id IS NULL AND class_level IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_char_ancestry_acq_character_id ON public.character_ancestry_acquisitions (character_id);
CREATE INDEX IF NOT EXISTS idx_char_ancestry_acq_ancestry_id ON public.character_ancestry_acquisitions (ancestry_id);
CREATE INDEX IF NOT EXISTS idx_char_ancestry_acq_option_id ON public.character_ancestry_acquisitions (option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_ancestry_acquisitions_updated_at'
      AND tgrelid = 'public.character_ancestry_acquisitions'::regclass) THEN
  CREATE TRIGGER trg_character_ancestry_acquisitions_updated_at
    BEFORE UPDATE ON public.character_ancestry_acquisitions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_ancestry_acquisitions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_classes (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
  subclass_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  subtype_id uuid REFERENCES public.class_subtypes (id) ON DELETE SET NULL DEFERRABLE,
  class_level integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_classes_class_level_chk CHECK (
    class_level > 0
  ),
  PRIMARY KEY (character_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_char_classes_class_id ON public.character_classes (class_id);
CREATE INDEX IF NOT EXISTS idx_char_classes_subclass_id ON public.character_classes (subclass_id);
CREATE INDEX IF NOT EXISTS idx_char_classes_subtype_id ON public.character_classes (subtype_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_classes_updated_at'
      AND tgrelid = 'public.character_classes'::regclass) THEN
  CREATE TRIGGER trg_character_classes_updated_at
    BEFORE UPDATE ON public.character_classes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_classes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_hitpoint_intent (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  method_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_hitpoint_intent_method_chk CHECK (
    method_code IN ('FIXED', 'MANUAL')
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_hitpoint_intent_updated_at'
      AND tgrelid = 'public.character_hitpoint_intent'::regclass) THEN
  CREATE TRIGGER trg_character_hitpoint_intent_updated_at
    BEFORE UPDATE ON public.character_hitpoint_intent
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_hitpoint_intent ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_hitpoint_levels (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  char_level integer NOT NULL,
  value integer NOT NULL,
  overridden boolean,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, char_level),
  CONSTRAINT character_hitpoint_levels_value_chk CHECK (
    char_level > 0
    AND value >= 0
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_hitpoint_levels_updated_at'
      AND tgrelid = 'public.character_hitpoint_levels'::regclass) THEN
  CREATE TRIGGER trg_character_hitpoint_levels_updated_at
    BEFORE UPDATE ON public.character_hitpoint_levels
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_hitpoint_levels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_hitpoint_level_rolls (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  char_level integer NOT NULL,
  roll_index integer NOT NULL,
  die integer NOT NULL,
  value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, char_level, roll_index),
  CONSTRAINT character_hitpoint_level_rolls_value_chk CHECK (
    char_level > 0
    AND roll_index >= 0
    AND die > 0
    AND value >= 0
    AND value <= die
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_hitpoint_level_rolls_updated_at'
      AND tgrelid = 'public.character_hitpoint_level_rolls'::regclass) THEN
  CREATE TRIGGER trg_character_hitpoint_level_rolls_updated_at
    BEFORE UPDATE ON public.character_hitpoint_level_rolls
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_hitpoint_level_rolls ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_hitpoint_state (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  current integer,
  temp integer,
  max_override integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_hitpoint_state_nonnegative_chk CHECK (
    (current IS NULL OR current >= 0)
    AND (temp IS NULL OR temp >= 0)
    AND (max_override IS NULL OR max_override >= 0)
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_hitpoint_state_updated_at'
      AND tgrelid = 'public.character_hitpoint_state'::regclass) THEN
  CREATE TRIGGER trg_character_hitpoint_state_updated_at
    BEFORE UPDATE ON public.character_hitpoint_state
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_hitpoint_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_hit_dice_state (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  die integer NOT NULL,
  total integer NOT NULL,
  used integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, die),
  CONSTRAINT character_hit_dice_state_values_chk CHECK (
    die > 0
    AND total >= 0
    AND used >= 0
    AND used <= total
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_hit_dice_state_updated_at'
      AND tgrelid = 'public.character_hit_dice_state'::regclass) THEN
  CREATE TRIGGER trg_character_hit_dice_state_updated_at
    BEFORE UPDATE ON public.character_hit_dice_state
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_hit_dice_state ENABLE ROW LEVEL SECURITY;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'spell_state'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.spell_state AS ENUM (
            'PREPARED',
            'KNOWN'
        );
    END IF;
END;
$$;


CREATE TABLE IF NOT EXISTS public.character_class_spells (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE DEFERRABLE,
  spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
  state spell_state NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, class_id, spell_id)
);

CREATE INDEX IF NOT EXISTS idx_char_class_spells_class_id ON public.character_class_spells (class_id);
CREATE INDEX IF NOT EXISTS idx_char_class_spells_spell_id ON public.character_class_spells (spell_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_class_spells_updated_at'
      AND tgrelid = 'public.character_class_spells'::regclass) THEN
  CREATE TRIGGER trg_character_class_spells_updated_at
    BEFORE UPDATE ON public.character_class_spells
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_class_spells ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE,
  quantity integer NOT NULL DEFAULT 1,
  container_id uuid REFERENCES public.character_equipment (id) ON DELETE SET NULL DEFERRABLE,
  container_path text,
  custom_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_equipment_quantity_chk CHECK (
    quantity > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_char_equip_char_id ON public.character_equipment (character_id);
CREATE INDEX IF NOT EXISTS idx_char_equip_equipment_id ON public.character_equipment (equipment_id);
CREATE INDEX IF NOT EXISTS idx_char_equip_container_id ON public.character_equipment (container_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_equipment_updated_at'
      AND tgrelid = 'public.character_equipment'::regclass) THEN
  CREATE TRIGGER trg_character_equipment_updated_at
    BEFORE UPDATE ON public.character_equipment
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_equipment ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_equipped (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  equipment_id uuid NOT NULL REFERENCES public.character_equipment (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_char_equipped_equipment_id ON public.character_equipped (equipment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_equipped_updated_at'
      AND tgrelid = 'public.character_equipped'::regclass) THEN
  CREATE TRIGGER trg_character_equipped_updated_at
    BEFORE UPDATE ON public.character_equipped
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_equipped ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_attuned (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  equipment_id uuid NOT NULL REFERENCES public.character_equipment (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_char_attuned_equipment_id ON public.character_attuned (equipment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_attuned_updated_at'
      AND tgrelid = 'public.character_attuned'::regclass) THEN
  CREATE TRIGGER trg_character_attuned_updated_at
    BEFORE UPDATE ON public.character_attuned
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_attuned ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_currency_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  container_id uuid REFERENCES public.character_equipment (id) ON DELETE SET NULL DEFERRABLE
);

CREATE INDEX IF NOT EXISTS idx_char_cur_groups_char_id ON public.character_currency_groups (character_id);
CREATE INDEX IF NOT EXISTS idx_char_cur_groups_container_id ON public.character_currency_groups (container_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_currency_groups_updated_at'
      AND tgrelid = 'public.character_currency_groups'::regclass) THEN
  CREATE TRIGGER trg_character_currency_groups_updated_at
    BEFORE UPDATE ON public.character_currency_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_currency_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_currencies (
  group_id uuid NOT NULL REFERENCES public.character_currency_groups (id) ON DELETE CASCADE DEFERRABLE,
  currency_id uuid NOT NULL REFERENCES public.currencies (id) ON DELETE CASCADE DEFERRABLE,
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, currency_id),
  CONSTRAINT character_currencies_amount_chk CHECK (
    amount >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_character_currencies_currency_id
  ON public.character_currencies (currency_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_currencies_updated_at'
      AND tgrelid = 'public.character_currencies'::regclass) THEN
  CREATE TRIGGER trg_character_currencies_updated_at
    BEFORE UPDATE ON public.character_currencies
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_currencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_resources (
  character_id uuid NOT NULL
    REFERENCES public.characters (id)
    ON DELETE CASCADE,

  resource_grant_id uuid NOT NULL
    ,
  used integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  PRIMARY KEY (character_id, resource_grant_id),
  CONSTRAINT character_resources_used_chk CHECK (
    used >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_character_resources_resource_grant_id
  ON public.character_resources (resource_grant_id);

ALTER TABLE IF EXISTS public.character_resources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_trigger
    WHERE
      tgname = 'trg_character_resources_updated_at'
      AND tgrelid = 'public.character_resources'::regclass) THEN
  CREATE TRIGGER trg_character_resources_updated_at
    BEFORE UPDATE ON public.character_resources
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at ( );
END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.character_feature_acquisitions (
  id uuid PRIMARY KEY,
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE DEFERRABLE,
  source_kind text NOT NULL,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  subclass_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  race_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  subrace_id uuid REFERENCES public.races (id) ON DELETE SET NULL DEFERRABLE,
  ancestry_id uuid REFERENCES public.race_ancestries (id) ON DELETE SET NULL DEFERRABLE,
  option_id uuid REFERENCES public.options (id) ON DELETE SET NULL DEFERRABLE,
  acquired_parent_id uuid REFERENCES public.character_feature_acquisitions (id) ON DELETE SET NULL DEFERRABLE,
  background_id uuid REFERENCES public.backgrounds (id) ON DELETE SET NULL DEFERRABLE,
  feat_id uuid REFERENCES public.feats (id) ON DELETE SET NULL DEFERRABLE,
  reason text,
  timing_kind text NOT NULL,
  timing_level integer,
  timing_class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  timing_class_level integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_feature_acq_source_kind_chk CHECK (
    source_kind IN ('CLASS', 'SUBCLASS', 'RACE', 'SUBRACE', 'ANCESTRY', 'BACKGROUND', 'FEAT', 'FEATURE', 'OPTION', 'MANUAL')
  ),
  CONSTRAINT character_feature_acq_timing_kind_chk CHECK (
    timing_kind IN ('IMMEDIATE', 'CHARACTER_LEVEL', 'CLASS_LEVEL')
  ),
  CONSTRAINT character_feature_acq_option_parent_chk CHECK (
    (source_kind = 'OPTION' AND option_id IS NOT NULL AND acquired_parent_id IS NOT NULL)
    OR (source_kind <> 'OPTION' AND acquired_parent_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_character_feature_acq_character_id ON public.character_feature_acquisitions (character_id);
CREATE INDEX IF NOT EXISTS idx_character_feature_acq_feature_id ON public.character_feature_acquisitions (feature_id);
CREATE INDEX IF NOT EXISTS idx_character_feature_acq_parent_id ON public.character_feature_acquisitions (acquired_parent_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_feature_acquisitions_updated_at'
      AND tgrelid = 'public.character_feature_acquisitions'::regclass) THEN
  CREATE TRIGGER trg_character_feature_acquisitions_updated_at
    BEFORE UPDATE ON public.character_feature_acquisitions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_feature_acquisitions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_feature_selection_records (
  feature_acquisition_id uuid NOT NULL REFERENCES public.character_feature_acquisitions (id) ON DELETE CASCADE DEFERRABLE,
  selection_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (feature_acquisition_id, selection_key)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_feature_selection_records_updated_at'
      AND tgrelid = 'public.character_feature_selection_records'::regclass) THEN
  CREATE TRIGGER trg_character_feature_selection_records_updated_at
    BEFORE UPDATE ON public.character_feature_selection_records
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_feature_selection_records ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_feature_selection_values (
  feature_acquisition_id uuid NOT NULL,
  selection_key text NOT NULL,
  value_index integer NOT NULL,
  value_kind text NOT NULL,
  text_value text,
  number_value numeric,
  boolean_value boolean,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (feature_acquisition_id, selection_key, value_index),
  FOREIGN KEY (feature_acquisition_id, selection_key)
    REFERENCES public.character_feature_selection_records (feature_acquisition_id, selection_key)
    ON DELETE CASCADE DEFERRABLE,
  CONSTRAINT character_feature_selection_value_kind_chk CHECK (
    value_kind IN ('ID', 'IDS', 'NUMBER', 'BOOLEAN')
  ),
  CONSTRAINT character_feature_selection_value_payload_chk CHECK (
    (
      value_kind IN ('ID', 'IDS')
      AND text_value IS NOT NULL
      AND number_value IS NULL
      AND boolean_value IS NULL
    )
    OR (
      value_kind = 'NUMBER'
      AND text_value IS NULL
      AND number_value IS NOT NULL
      AND boolean_value IS NULL
    )
    OR (
      value_kind = 'BOOLEAN'
      AND text_value IS NULL
      AND number_value IS NULL
      AND boolean_value IS NOT NULL
    )
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_feature_selection_values_updated_at'
      AND tgrelid = 'public.character_feature_selection_values'::regclass) THEN
  CREATE TRIGGER trg_character_feature_selection_values_updated_at
    BEFORE UPDATE ON public.character_feature_selection_values
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_feature_selection_values ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_spell_selections (
  id uuid PRIMARY KEY,
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  source_kind text NOT NULL,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  subclass_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  feature_id uuid REFERENCES public.features (id) ON DELETE SET NULL DEFERRABLE,
  option_id uuid REFERENCES public.options (id) ON DELETE SET NULL DEFERRABLE,
  acquired_parent_id uuid REFERENCES public.character_feature_acquisitions (id) ON DELETE SET NULL DEFERRABLE,
  timing_kind text NOT NULL,
  timing_level integer,
  timing_class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  timing_class_level integer,
  replaced_selection_id uuid REFERENCES public.character_spell_selections (id) ON DELETE SET NULL DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_spell_selection_source_kind_chk CHECK (
    source_kind IN ('CLASS', 'SUBCLASS', 'FEATURE', 'OPTION')
  ),
  CONSTRAINT character_spell_selection_timing_kind_chk CHECK (
    timing_kind IN ('IMMEDIATE', 'CHARACTER_LEVEL', 'CLASS_LEVEL')
  ),
  CONSTRAINT character_spell_selection_source_ref_chk CHECK (
    (source_kind = 'CLASS' AND class_id IS NOT NULL AND subclass_id IS NULL AND feature_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL)
    OR (source_kind = 'SUBCLASS' AND class_id IS NULL AND subclass_id IS NOT NULL AND feature_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL)
    OR (source_kind = 'FEATURE' AND class_id IS NULL AND subclass_id IS NULL AND feature_id IS NOT NULL AND option_id IS NULL AND acquired_parent_id IS NULL)
    OR (source_kind = 'OPTION' AND class_id IS NULL AND subclass_id IS NULL AND feature_id IS NULL AND option_id IS NOT NULL AND acquired_parent_id IS NOT NULL)
  ),
  CONSTRAINT character_spell_selection_timing_ref_chk CHECK (
    (timing_kind = 'IMMEDIATE' AND timing_level IS NULL AND timing_class_id IS NULL AND timing_class_level IS NULL)
    OR (timing_kind = 'CHARACTER_LEVEL' AND timing_level IS NOT NULL AND timing_level > 0 AND timing_class_id IS NULL AND timing_class_level IS NULL)
    OR (timing_kind = 'CLASS_LEVEL' AND timing_level IS NULL AND timing_class_id IS NOT NULL AND timing_class_level IS NOT NULL AND timing_class_level > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_character_spell_selections_character_id
  ON public.character_spell_selections (character_id);

CREATE INDEX IF NOT EXISTS idx_character_spell_selections_replaced_selection_id
  ON public.character_spell_selections (replaced_selection_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_spell_selections_updated_at'
      AND tgrelid = 'public.character_spell_selections'::regclass) THEN
  CREATE TRIGGER trg_character_spell_selections_updated_at
    BEFORE UPDATE ON public.character_spell_selections
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_spell_selections ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_spell_selection_spells (
  selection_id uuid NOT NULL REFERENCES public.character_spell_selections (id) ON DELETE CASCADE DEFERRABLE,
  spell_id uuid NOT NULL REFERENCES public.spells (id) ON DELETE CASCADE DEFERRABLE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (selection_id, spell_id)
);

CREATE INDEX IF NOT EXISTS idx_character_spell_selection_spells_spell_id
  ON public.character_spell_selection_spells (spell_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_spell_selection_spells_updated_at'
      AND tgrelid = 'public.character_spell_selection_spells'::regclass) THEN
  CREATE TRIGGER trg_character_spell_selection_spells_updated_at
    BEFORE UPDATE ON public.character_spell_selection_spells
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_spell_selection_spells ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_resource_grants (
  id uuid PRIMARY KEY,
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE DEFERRABLE,
  resource_id uuid NOT NULL REFERENCES public.class_resources (id) ON DELETE CASCADE DEFERRABLE,
  source_kind text NOT NULL,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  subclass_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  feature_id uuid REFERENCES public.features (id) ON DELETE SET NULL DEFERRABLE,
  option_id uuid REFERENCES public.options (id) ON DELETE SET NULL DEFERRABLE,
  acquired_parent_id uuid REFERENCES public.character_feature_acquisitions (id) ON DELETE SET NULL DEFERRABLE,
  timing_kind text NOT NULL,
  timing_level integer,
  timing_class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL DEFERRABLE,
  timing_class_level integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_resource_grants_source_kind_chk CHECK (
    source_kind IN ('CLASS', 'SUBCLASS', 'FEATURE', 'OPTION')
  ),
  CONSTRAINT character_resource_grants_timing_kind_chk CHECK (
    timing_kind IN ('IMMEDIATE', 'CHARACTER_LEVEL', 'CLASS_LEVEL')
  ),
  CONSTRAINT character_resource_grants_source_ref_chk CHECK (
    (source_kind = 'CLASS' AND class_id IS NOT NULL AND subclass_id IS NULL AND feature_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL)
    OR (source_kind = 'SUBCLASS' AND class_id IS NULL AND subclass_id IS NOT NULL AND feature_id IS NULL AND option_id IS NULL AND acquired_parent_id IS NULL)
    OR (source_kind = 'FEATURE' AND class_id IS NULL AND subclass_id IS NULL AND feature_id IS NOT NULL AND option_id IS NULL AND acquired_parent_id IS NULL)
    OR (source_kind = 'OPTION' AND class_id IS NULL AND subclass_id IS NULL AND feature_id IS NULL AND option_id IS NOT NULL AND acquired_parent_id IS NOT NULL)
  ),
  CONSTRAINT character_resource_grants_timing_ref_chk CHECK (
    (timing_kind = 'IMMEDIATE' AND timing_level IS NULL AND timing_class_id IS NULL AND timing_class_level IS NULL)
    OR (timing_kind = 'CHARACTER_LEVEL' AND timing_level IS NOT NULL AND timing_level > 0 AND timing_class_id IS NULL AND timing_class_level IS NULL)
    OR (timing_kind = 'CLASS_LEVEL' AND timing_level IS NULL AND timing_class_id IS NOT NULL AND timing_class_level IS NOT NULL AND timing_class_level > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_character_resource_grants_character_id
  ON public.character_resource_grants (character_id);

CREATE INDEX IF NOT EXISTS idx_character_resource_grants_resource_id
  ON public.character_resource_grants (resource_id);

CREATE INDEX IF NOT EXISTS idx_character_resource_grants_parent_id
  ON public.character_resource_grants (acquired_parent_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_resource_grants_updated_at'
      AND tgrelid = 'public.character_resource_grants'::regclass) THEN
  CREATE TRIGGER trg_character_resource_grants_updated_at
    BEFORE UPDATE ON public.character_resource_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;
$$;

ALTER TABLE IF EXISTS public.character_resource_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_constraint
    WHERE
      conname = 'character_resources_resource_grant_id_fkey'
      AND conrelid = 'public.character_resources'::regclass) THEN
  ALTER TABLE public.character_resources
    ADD CONSTRAINT character_resources_resource_grant_id_fkey
    FOREIGN KEY (resource_grant_id)
    REFERENCES public.character_resource_grants (id)
    ON DELETE CASCADE
    DEFERRABLE;
END IF;
END;
$$;

-- Abilities core selection
CREATE TABLE IF NOT EXISTS public.character_abilities (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE,
  method_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT character_abilities_method_chk CHECK (
    method_code IN ('STANDARD_ARRAY', 'POINT_BUY', 'MANUAL_ROLLED')
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_updated_at'
      AND tgrelid = 'public.character_abilities'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_updated_at
    BEFORE UPDATE ON public.character_abilities
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities ENABLE ROW LEVEL SECURITY;

-- Manual rolled
CREATE TABLE IF NOT EXISTS public.character_abilities_manual_rolled (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE,
  configuration text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_manual_rolled_updated_at'
      AND tgrelid = 'public.character_abilities_manual_rolled'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_manual_rolled_updated_at
    BEFORE UPDATE ON public.character_abilities_manual_rolled
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_manual_rolled ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_abilities_manual_rolled_groups (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  group_index int NOT NULL,
  id text NOT NULL,
  assigned_ability_code text,
  score int NOT NULL,
  applied boolean,
  rolling boolean,
  PRIMARY KEY (character_id, group_index),
  CONSTRAINT character_abilities_manual_rolled_groups_score_chk CHECK (
    score >= 0
  ),
  CONSTRAINT character_abilities_manual_rolled_groups_id_uniq UNIQUE (character_id, id)
);

ALTER TABLE IF EXISTS public.character_abilities_manual_rolled_groups
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_manual_rolled_groups_updated_at'
      AND tgrelid = 'public.character_abilities_manual_rolled_groups'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_manual_rolled_groups_updated_at
    BEFORE UPDATE ON public.character_abilities_manual_rolled_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_manual_rolled_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_abilities_manual_rolled_rolls (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  group_index int NOT NULL,
  roll_index int NOT NULL,
  die int NOT NULL,
  value int NOT NULL,
  is_kept boolean,
  PRIMARY KEY (character_id, group_index, roll_index),
  CONSTRAINT character_abilities_manual_rolled_rolls_die_chk CHECK (
    die > 0
  ),
  CONSTRAINT character_abilities_manual_rolled_rolls_value_chk CHECK (
    value >= 0 AND value <= die
  )
);

ALTER TABLE IF EXISTS public.character_abilities_manual_rolled_rolls
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_manual_rolled_rolls_updated_at'
      AND tgrelid = 'public.character_abilities_manual_rolled_rolls'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_manual_rolled_rolls_updated_at
    BEFORE UPDATE ON public.character_abilities_manual_rolled_rolls
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_manual_rolled_rolls ENABLE ROW LEVEL SECURITY;

-- Manual rolled assignments
CREATE TABLE IF NOT EXISTS public.character_abilities_manual_assignments (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  ability_code text NOT NULL,
  score int NOT NULL,
  PRIMARY KEY (character_id, ability_code),
  CONSTRAINT character_abilities_manual_assignments_score_chk CHECK (
    score >= 0
  )
);

ALTER TABLE IF EXISTS public.character_abilities_manual_assignments
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_manual_assignments_updated_at'
      AND tgrelid = 'public.character_abilities_manual_assignments'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_manual_assignments_updated_at
    BEFORE UPDATE ON public.character_abilities_manual_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_manual_assignments ENABLE ROW LEVEL SECURITY;

-- Point buy
CREATE TABLE IF NOT EXISTS public.character_abilities_point_buy (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE
);

ALTER TABLE IF EXISTS public.character_abilities_point_buy
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_point_buy_updated_at'
      AND tgrelid = 'public.character_abilities_point_buy'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_point_buy_updated_at
    BEFORE UPDATE ON public.character_abilities_point_buy
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_point_buy ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_abilities_point_buy_distributed (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  ability_code text NOT NULL,
  option_code text NOT NULL,
  PRIMARY KEY (character_id, ability_code),
  CONSTRAINT character_abilities_point_buy_option_chk CHECK (
    option_code IN ('8', '9', '10', '11', '12', '13', '14', '15')
  )
);

ALTER TABLE IF EXISTS public.character_abilities_point_buy_distributed
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_point_buy_distributed_updated_at'
      AND tgrelid = 'public.character_abilities_point_buy_distributed'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_point_buy_distributed_updated_at
    BEFORE UPDATE ON public.character_abilities_point_buy_distributed
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_point_buy_distributed ENABLE ROW LEVEL SECURITY;

-- Standard array
CREATE TABLE IF NOT EXISTS public.character_abilities_standard_array (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  ability_code text NOT NULL,
  option_code text NOT NULL,
  PRIMARY KEY (character_id, ability_code),
  CONSTRAINT character_abilities_standard_array_option_chk CHECK (
    option_code IN ('8', '10', '12', '13', '14', '15')
  )
);

ALTER TABLE IF EXISTS public.character_abilities_standard_array
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_abilities_standard_array_updated_at'
      AND tgrelid = 'public.character_abilities_standard_array'::regclass) THEN
  CREATE TRIGGER trg_character_abilities_standard_array_updated_at
    BEFORE UPDATE ON public.character_abilities_standard_array
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_abilities_standard_array ENABLE ROW LEVEL SECURITY;

-- Class starting equipment selections per character
CREATE TABLE IF NOT EXISTS public.character_class_equipment_session (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE,
  option uuid REFERENCES public.starting_equipment_options (id) ON DELETE SET NULL,
  gold_option uuid REFERENCES public.starting_equipment_options (id) ON DELETE SET NULL,
  total_gold int,
  applied boolean,
  CONSTRAINT character_class_equipment_session_choice_chk CHECK (
    ((option IS NOT NULL)::int + (gold_option IS NOT NULL)::int) <= 1
  ),
  CONSTRAINT character_class_equipment_session_gold_chk CHECK (
    (gold_option IS NOT NULL AND total_gold IS NOT NULL AND total_gold >= 0)
    OR (gold_option IS NULL AND total_gold IS NULL)
  )
);

ALTER TABLE IF EXISTS public.character_class_equipment_session
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_class_equipment_session_updated_at'
      AND tgrelid = 'public.character_class_equipment_session'::regclass) THEN
  CREATE TRIGGER trg_character_class_equipment_session_updated_at
    BEFORE UPDATE ON public.character_class_equipment_session
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_class_equipment_session ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_class_equipment_groups (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.starting_equipment_groups (id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.starting_equipment_options (id) ON DELETE CASCADE,
  PRIMARY KEY (character_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_char_class_equip_groups_option_id
  ON public.character_class_equipment_groups (option_id);

ALTER TABLE IF EXISTS public.character_class_equipment_groups
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_class_equipment_groups_updated_at'
      AND tgrelid = 'public.character_class_equipment_groups'::regclass) THEN
  CREATE TRIGGER trg_character_class_equipment_groups_updated_at
    BEFORE UPDATE ON public.character_class_equipment_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_class_equipment_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_class_equipment_items (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.starting_equipment_groups (id) ON DELETE CASCADE,
  selection_item_id uuid REFERENCES public.starting_equipment_option_items (id) ON DELETE SET NULL,
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1,
  PRIMARY KEY (character_id, group_id, equipment_id),
  CONSTRAINT character_class_equipment_items_quantity_chk CHECK (
    quantity > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_char_class_equip_items_selection_item_id
  ON public.character_class_equipment_items (selection_item_id);

CREATE INDEX IF NOT EXISTS idx_char_class_equip_items_equipment_id
  ON public.character_class_equipment_items (equipment_id);

ALTER TABLE IF EXISTS public.character_class_equipment_items
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_class_equipment_items_updated_at'
      AND tgrelid = 'public.character_class_equipment_items'::regclass) THEN
  CREATE TRIGGER trg_character_class_equipment_items_updated_at
    BEFORE UPDATE ON public.character_class_equipment_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_class_equipment_items ENABLE ROW LEVEL SECURITY;

-- Background starting equipment selections per character
CREATE TABLE IF NOT EXISTS public.character_background_equipment_session (
  character_id uuid PRIMARY KEY REFERENCES public.characters (id) ON DELETE CASCADE,
  applied boolean
);

ALTER TABLE IF EXISTS public.character_background_equipment_session
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_background_equipment_session_updated_at'
      AND tgrelid = 'public.character_background_equipment_session'::regclass) THEN
  CREATE TRIGGER trg_character_background_equipment_session_updated_at
    BEFORE UPDATE ON public.character_background_equipment_session
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_background_equipment_session ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_background_equipment_groups (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.starting_equipment_groups (id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.starting_equipment_options (id) ON DELETE CASCADE,
  PRIMARY KEY (character_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_char_bg_equip_groups_option_id
  ON public.character_background_equipment_groups (option_id);

ALTER TABLE IF EXISTS public.character_background_equipment_groups
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_background_equipment_groups_updated_at'
      AND tgrelid = 'public.character_background_equipment_groups'::regclass) THEN
  CREATE TRIGGER trg_character_background_equipment_groups_updated_at
    BEFORE UPDATE ON public.character_background_equipment_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_background_equipment_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_background_equipment_items (
  character_id uuid NOT NULL REFERENCES public.characters (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.starting_equipment_groups (id) ON DELETE CASCADE,
  selection_item_id uuid REFERENCES public.starting_equipment_option_items (id) ON DELETE SET NULL,
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1,
  PRIMARY KEY (character_id, group_id, equipment_id),
  CONSTRAINT character_background_equipment_items_quantity_chk CHECK (
    quantity > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_char_bg_equip_items_selection_item_id
  ON public.character_background_equipment_items (selection_item_id);

CREATE INDEX IF NOT EXISTS idx_char_bg_equip_items_equipment_id
  ON public.character_background_equipment_items (equipment_id);

ALTER TABLE IF EXISTS public.character_background_equipment_items
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_character_background_equipment_items_updated_at'
      AND tgrelid = 'public.character_background_equipment_items'::regclass) THEN
  CREATE TRIGGER trg_character_background_equipment_items_updated_at
    BEFORE UPDATE ON public.character_background_equipment_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
END IF;
END;$$;

ALTER TABLE IF EXISTS public.character_background_equipment_items ENABLE ROW LEVEL SECURITY;
-- END INCLUDE: src\domains\subjects\tables\characters.sql
-- BEGIN INCLUDE: src\domains\subjects\tables\classes.sql
/* ──────────────────────────────────────────────
 * CLASSES — ROOT
 *
 * Intent:
 *   Stores authored Classes and Subclasses (category-driven).
 *   Base classes may own: starting gold, hitpoints, starting equipment,
 *   spellcasting, multiclass requirements, proficiencies, and features.
 *
 *   Subclasses attach to a parent class and may define subtypes,
 *   plus their own proficiencies and features.
 *
 * Cardinality:
 *   systems 1 ──▶ N classes
 *   classes 1 ──▶ N class_details (owned)
 *   classes 1 ──▶ N class_proficiency_grants (owned)
 *   classes 1 ──▶ N class_features (owned)
 *   classes 0..1 ──▶ 1 class_hitpoints (BASE only)
 *   classes 0..1 ──▶ 1 class_starting_gold (BASE only)
 *   classes 0..1 ──▶ 1 starting_equipment (owned FK, BASE only)
 *   classes 0..1 ──▶ 1 class_spellcasting (owned subtree, BASE only)
 *   classes 0..1 ──▶ 1 class_resource (owned subtree, optional)
 *   classes 0..1 ──▶ 1 class_multiclass (owned subtree, BASE only)
 *   classes 1 ──▶ N class_subtypes (SUBCLASS only)
 *
 * Ownership:
 *   - class_details owns details rows via bridge trigger
 *   - class_proficiency_grants owns proficiency_grants via bridge trigger
 *   - class_features owns features via bridge trigger
 *   - classes.starting_equipment_id is owned FK (cleanup on delete/update)
 *   - class_spellcasting owns its charges via FK (cleanup on delete/update)
 *   - class_resource owns its charges via FK (cleanup on delete/update)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY,

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,

  category text NOT NULL, -- ClassCategoryCode (BASE|SUBCLASS)

  parent_class_id uuid
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  description text,

  starting_equipment_id uuid
    REFERENCES public.starting_equipment(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  is_master boolean,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT classes_category_chk CHECK (
    category IN ('BASE', 'SUBCLASS')
  ),
  CONSTRAINT classes_category_parent_chk CHECK (
    (category = 'BASE' AND parent_class_id IS NULL AND starting_equipment_id IS NOT NULL)
    OR (category = 'SUBCLASS' AND parent_class_id IS NOT NULL AND starting_equipment_id IS NULL)
  )
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

SELECT public.apply_system_derived_policies('classes');

CREATE INDEX IF NOT EXISTS idx_classes_system
  ON public.classes(system_id);

CREATE INDEX IF NOT EXISTS idx_classes_parent
  ON public.classes(parent_class_id);

CREATE TABLE IF NOT EXISTS public.class_attributes (
  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  attribute_code text NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (class_id, attribute_code)
);

CREATE INDEX IF NOT EXISTS idx_class_attributes_class
  ON public.class_attributes(class_id);

ALTER TABLE public.class_attributes ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CLASS — TRAITS (CODES)
 * ────────────────────────────────────────────── */

/* ──────────────────────────────────────────────
 * CLASS — DETAILS (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_details (
  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  detail_id uuid NOT NULL
    REFERENCES public.details(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  PRIMARY KEY (class_id, detail_id)
);

CREATE INDEX IF NOT EXISTS idx_class_details_class
  ON public.class_details(class_id);

ALTER TABLE public.class_details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_details_owned'
      AND tgrelid = 'public.class_details'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_details_owned
    AFTER DELETE ON public.class_details
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.details",
      "columns": ["detail_id"]
    }]');
  END IF;
END;
$$;


/* ──────────────────────────────────────────────
 * CLASS — PROFICIENCY GRANTS (OWNED BRIDGE)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_proficiency_grants (
  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  proficiency_grant_id uuid NOT NULL,

  sort_order integer NOT NULL,

  PRIMARY KEY (class_id, proficiency_grant_id)
);

ALTER TABLE public.class_proficiency_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_proficiency_grants_class
  ON public.class_proficiency_grants(class_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_proficiency_grants_owned'
      AND tgrelid = 'public.class_proficiency_grants'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_proficiency_grants_owned
    AFTER DELETE ON public.class_proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.proficiency_grants",
      "columns": ["proficiency_grant_id"]
    }]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * CLASS — FEATURES (OWNED BRIDGE)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_features (
  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  feature_id uuid NOT NULL,

  sort_order integer NOT NULL,

  PRIMARY KEY (class_id, feature_id)
);

ALTER TABLE public.class_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_features_class
  ON public.class_features(class_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_features_owned'
      AND tgrelid = 'public.class_features'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_features_owned
    AFTER DELETE ON public.class_features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.features",
      "columns": ["feature_id"]
    }]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * CLASS — HITPOINTS (BASE ONLY)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_hitpoints (
  class_id uuid PRIMARY KEY
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  ability_code text NOT NULL, -- AbilityCode
  die_config text NOT NULL
);

ALTER TABLE public.class_hitpoints ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * CLASS — STARTING GOLD (BASE ONLY)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_starting_gold (
  class_id uuid PRIMARY KEY
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  multiplier integer NOT NULL,
  currency_id uuid NOT NULL
    REFERENCES public.currencies(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  die_config text NOT NULL
);

ALTER TABLE public.class_starting_gold ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * OWNED FK CLEANUP: classes → starting_equipment
 *
 * Intent:
 *   starting_equipment_id is owned by the class.
 *   - On class delete: delete owned row.
 *   - On starting_equipment_id update/clear: delete old owned row.
 * ────────────────────────────────────────────── */

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_classes_starting_equipment_owned'
      AND tgrelid = 'public.classes'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_classes_starting_equipment_owned
    AFTER DELETE ON public.classes
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.starting_equipment",
      "columns": ["starting_equipment_id"]
    }]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_classes_starting_equipment_owned_on_update'
      AND tgrelid = 'public.classes'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_classes_starting_equipment_owned_on_update
    AFTER UPDATE OF starting_equipment_id ON public.classes
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[{
      "table": "public.starting_equipment",
      "columns": ["starting_equipment_id"]
    }]');
  END IF;
END;
$$;


/* ──────────────────────────────────────────────
 * CLASS — RESOURCES (OWNED, OPTIONAL)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  description text,
  available_at_level integer NOT NULL,

  charge_id uuid NOT NULL
    REFERENCES public.charges(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.class_resources ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_class_resources_class
  ON public.class_resources(class_id);

CREATE INDEX IF NOT EXISTS idx_class_resources_charge
  ON public.class_resources(charge_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_resources_charge_owned'
      AND tgrelid = 'public.class_resources'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_resources_charge_owned
    AFTER DELETE ON public.class_resources
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.charges",
      "columns": ["charge_id"]
    }]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_resources_charge_owned_on_update'
      AND tgrelid = 'public.class_resources'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_resources_charge_owned_on_update
    AFTER UPDATE OF charge_id ON public.class_resources
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[{
      "table": "public.charges",
      "columns": ["charge_id"]
    }]');
  END IF;
END;
$$;


/* ──────────────────────────────────────────────
 * CLASS — SPELLCASTING (OWNED SUBTREE, OPTIONAL)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_spellcasting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  magic_name text,
  ability_code text,         -- AbilityCode
  max_spell_level integer NOT NULL,

  charge_id uuid NOT NULL
    REFERENCES public.charges(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.class_spellcasting ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_class_spellcasting_class
  ON public.class_spellcasting(class_id);

CREATE INDEX IF NOT EXISTS idx_class_spellcasting_charge
  ON public.class_spellcasting(charge_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_spellcasting_charge_owned'
      AND tgrelid = 'public.class_spellcasting'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_spellcasting_charge_owned
    AFTER DELETE ON public.class_spellcasting
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.charges",
      "columns": ["charge_id"]
    }]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_spellcasting_charge_owned_on_update'
      AND tgrelid = 'public.class_spellcasting'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_spellcasting_charge_owned_on_update
    AFTER UPDATE OF charge_id ON public.class_spellcasting
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[{
      "table": "public.charges",
      "columns": ["charge_id"]
    }]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * SPELLCASTING — TRAITS (CODES)
 * ────────────────────────────────────────────── */

/* ──────────────────────────────────────────────
 * SPELLCASTING — PREPARE LIMIT
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_spellcasting_attributes (
  spellcasting_id uuid NOT NULL
    REFERENCES public.class_spellcasting(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  attribute_code text NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (spellcasting_id, attribute_code)
);

ALTER TABLE public.class_spellcasting_attributes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_spellcasting_attributes_sc
  ON public.class_spellcasting_attributes(spellcasting_id);

CREATE TABLE IF NOT EXISTS public.class_spellcasting_prepare_limit (
  spellcasting_id uuid PRIMARY KEY
    REFERENCES public.class_spellcasting(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  scaling text,    -- ScalingAmountCode (optional)
  rounding text    -- RoundingCode (optional)
);

ALTER TABLE public.class_spellcasting_prepare_limit ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_spellcasting_prepare_limit_methods (
  spellcasting_id uuid NOT NULL
    REFERENCES public.class_spellcasting(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  method_code text NOT NULL, -- PrepareLimitMethodCode
  sort_order integer NOT NULL,

  PRIMARY KEY (spellcasting_id, method_code)
);

ALTER TABLE public.class_spellcasting_prepare_limit_methods ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_spellcasting_prepare_methods_sc
  ON public.class_spellcasting_prepare_limit_methods(spellcasting_id);

CREATE TABLE IF NOT EXISTS public.class_spellcasting_prepare_limit_levels (
  spellcasting_id uuid NOT NULL
    REFERENCES public.class_spellcasting(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  class_level integer NOT NULL,
  amount integer NOT NULL,

  PRIMARY KEY (spellcasting_id, class_level)
);

ALTER TABLE public.class_spellcasting_prepare_limit_levels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_spellcasting_prepare_levels_sc
  ON public.class_spellcasting_prepare_limit_levels(spellcasting_id);


/* ──────────────────────────────────────────────
 * SPELLCASTING — SPELL LIMITS / SLOTS
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_spell_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  spellcasting_id uuid NOT NULL
    REFERENCES public.class_spellcasting(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  class_level integer NOT NULL,

  learned_spells_limit integer,
  prepared_spells_limit integer,
  cantrips_limit integer
);

ALTER TABLE public.class_spell_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_spell_limits_sc
  ON public.class_spell_limits(spellcasting_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_class_spell_limits_sc_level
  ON public.class_spell_limits(spellcasting_id, class_level);

CREATE TABLE IF NOT EXISTS public.class_spell_slots (
  spell_limit_id uuid NOT NULL
    REFERENCES public.class_spell_limits(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  spell_level integer NOT NULL,
  slot_count integer NOT NULL,

  PRIMARY KEY (spell_limit_id, spell_level)
);

ALTER TABLE public.class_spell_slots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_spell_slots_limit
  ON public.class_spell_slots(spell_limit_id);


/* ──────────────────────────────────────────────
 * CLASS — MULTICLASS (OWNED SUBTREE, BASE ONLY)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_multiclass (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.class_multiclass ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_class_multiclass_class
  ON public.class_multiclass(class_id);

CREATE TABLE IF NOT EXISTS public.class_multiclass_requirement_groups (
  id uuid PRIMARY KEY,

  multiclass_id uuid NOT NULL
    REFERENCES public.class_multiclass(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL
);

ALTER TABLE public.class_multiclass_requirement_groups ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_multiclass_req_groups_mc
  ON public.class_multiclass_requirement_groups(multiclass_id);

CREATE TABLE IF NOT EXISTS public.class_multiclass_requirements (
  id uuid PRIMARY KEY,

  requirement_group_id uuid NOT NULL
    REFERENCES public.class_multiclass_requirement_groups(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  ability_code text NOT NULL,
  min integer NOT NULL,
  sort_order integer NOT NULL
);

ALTER TABLE public.class_multiclass_requirements ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_multiclass_reqs_group
  ON public.class_multiclass_requirements(requirement_group_id);


/* ──────────────────────────────────────────────
 * MULTICLASS — PROFICIENCY GRANTS (OWNED BRIDGE)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_multiclass_proficiency_grants (
  multiclass_id uuid NOT NULL
    REFERENCES public.class_multiclass(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  proficiency_grant_id uuid NOT NULL,

  sort_order integer NOT NULL,

  PRIMARY KEY (multiclass_id, proficiency_grant_id)
);

ALTER TABLE public.class_multiclass_proficiency_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_multiclass_prof_grants_mc
  ON public.class_multiclass_proficiency_grants(multiclass_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_class_multiclass_proficiency_grants_owned'
      AND tgrelid = 'public.class_multiclass_proficiency_grants'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_class_multiclass_proficiency_grants_owned
    AFTER DELETE ON public.class_multiclass_proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[{
      "table": "public.proficiency_grants",
      "columns": ["proficiency_grant_id"]
    }]');
  END IF;
END;
$$;


/* ──────────────────────────────────────────────
 * SUBCLASS — SUBTYPES
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.class_subtypes (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL
    REFERENCES public.classes(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  sort_order integer NOT NULL
);

ALTER TABLE public.class_subtypes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_class_subtypes_class
  ON public.class_subtypes(class_id);
-- END INCLUDE: src\domains\subjects\tables\classes.sql
-- BEGIN INCLUDE: src\domains\subjects\tables\equipment.sql
/*************************************************
* EQUIPMENT — AUTHORING STRUCTURE
*************************************************/
/* ──────────────────────────────────────────────
* EQUIPMENT — ROOT
*
* Intent:
*   Top-level equipment definition. May be a base
*   item or a variant container.
*
* Cardinality:
*   systems 1 ──▶ N equipment
*
* Ownership:
*   equipment → charges (owned FK)
*   equipment → effects (owned via bridge)
*   equipment → modifiers (owned via bridge)
*   equipment → restrictions (owned via bridge)
*   equipment → features (owned via bridge)
*   equipment → contains (owned rows)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment (
  id uuid PRIMARY KEY,
  system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  label text NOT NULL,
  description text,
  quote text,
  category text NOT NULL, -- EquipmentCategoryCode
  rarity_id uuid NOT NULL REFERENCES public.rarities (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  cost_amount integer NOT NULL,
  cost_currency_id uuid NOT NULL REFERENCES public.currencies (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  weight_amount numeric NOT NULL,
  weight_unit text NOT NULL,
  capacity_amount numeric,
  capacity_unit text,
  max_stack integer,
  max_bonus integer,
  armor_class integer,
  charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  restriction_id uuid REFERENCES public.facets (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  -- VARIANT only: links to parent equipment definition
  parent_equipment_id uuid REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  is_master boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_variant_parent_chk CHECK (
    (category = 'VARIANT' AND parent_equipment_id IS NOT NULL)
    OR (category <> 'VARIANT' AND parent_equipment_id IS NULL)
  ),
  CONSTRAINT equipment_capacity_chk CHECK (
    (capacity_amount IS NULL AND capacity_unit IS NULL)
    OR (capacity_amount IS NOT NULL AND capacity_unit IS NOT NULL)
  )
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

SELECT
  public.apply_system_derived_policies ('equipment');

CREATE INDEX IF NOT EXISTS idx_equipment_system ON public.equipment (system_id);

CREATE INDEX IF NOT EXISTS idx_equipment_parent ON public.equipment (parent_equipment_id);

CREATE TABLE IF NOT EXISTS public.equipment_attributes (
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  attribute_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (equipment_id, attribute_code)
);

ALTER TABLE public.equipment_attributes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_equipment_attributes_equipment ON public.equipment_attributes (equipment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_equipment_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_equipment_owned_on_update
    AFTER UPDATE ON public.equipment
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_cleanup_equipment_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_equipment_owned
    AFTER DELETE ON public.equipment
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] },
      { "table": "public.facets", "columns": ["restriction_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* EQUIPMENT — PROPERTIES
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment_properties (
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  property_code text NOT NULL,
  PRIMARY KEY (equipment_id, property_code)
);

ALTER TABLE public.equipment_properties ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
* EQUIPMENT — ABILITIES
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment_abilities (
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  operation text NOT NULL, -- EquipmentAbilityOperation
  ability_code text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (equipment_id, operation, ability_code)
);

ALTER TABLE public.equipment_abilities ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
* EQUIPMENT — SPEED
* ────────────────────────────────────────────── */
/* ──────────────────────────────────────────────
* EQUIPMENT — CONTAINS
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment_contains (
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  contained_equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  quantity integer NOT NULL,
  PRIMARY KEY (equipment_id, contained_equipment_id)
);

ALTER TABLE public.equipment_contains ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
* EQUIPMENT — EFFECTS (OWNED)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment_effects (
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  effect_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (equipment_id, effect_id)
);

ALTER TABLE public.equipment_effects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_equipment_effects_equipment ON public.equipment_effects (equipment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_equipment_effects_owned'
      AND tgrelid = 'public.equipment_effects'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_equipment_effects_owned
    AFTER DELETE ON public.equipment_effects
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.effects", "columns": ["effect_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* EQUIPMENT — MODIFIER GRANTS (OWNED)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment_modifier_grants (
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  modifier_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (equipment_id, modifier_grant_id)
);

ALTER TABLE public.equipment_modifier_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_equipment_modifier_grants_equipment ON public.equipment_modifier_grants (equipment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_equipment_modifier_grants_owned'
      AND tgrelid = 'public.equipment_modifier_grants'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_equipment_modifier_grants_owned
    AFTER DELETE ON public.equipment_modifier_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.modifier_grants", "columns": ["modifier_grant_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* EQUIPMENT — FEATURES (OWNED)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.equipment_features (
  equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  feature_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (equipment_id, feature_id)
);

ALTER TABLE public.equipment_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_equipment_features_equipment ON public.equipment_features (equipment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_equipment_features_owned'
      AND tgrelid = 'public.equipment_features'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_equipment_features_owned
    AFTER DELETE ON public.equipment_features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.features", "columns": ["feature_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* OWNED CHILD CLEANUP: equipment → charges
*
* Intent:
*   charge_id is an owned FK. When equipment is deleted,
*   delete the owned charge row.
*
*   When charge_id changes (or is cleared), delete the
*   old owned charge row.
* ────────────────────────────────────────────── */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_equipment_charge_owned'
      AND tgrelid = 'public.equipment'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_equipment_charge_owned
    AFTER DELETE ON public.equipment
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_equipment_charge_owned_on_update'
      AND tgrelid = 'public.equipment'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_equipment_charge_owned_on_update
    AFTER UPDATE OF charge_id ON public.equipment
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] }
    ]');
  END IF;
END;
$$;
-- END INCLUDE: src\domains\subjects\tables\equipment.sql
-- BEGIN INCLUDE: src\domains\subjects\tables\feats.sql
/* ──────────────────────────────────────────────
* FEATS — ROOT
*
* Intent:
*   A Feat is a top-level authored subject that grants
*   persistent capabilities, modifiers, and/or features.
*
* Cardinality:
*   systems 1 ──▶ N feats
*
* Ownership:
*   feats → charges (owned)
*   feats → effects (owned)
*   feats → modifier_grants (owned)
*   feats → proficiency_grants (owned)
*   feats → sense_grants (owned)
*   feats → spell_grants (owned)
*   feats → features (owned)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL REFERENCES public.systems (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  label text NOT NULL,
  description text NOT NULL,
  detail text,
  charge_id uuid REFERENCES public.charges (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  is_master boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT
  public.apply_system_derived_policies ('feats');

CREATE INDEX IF NOT EXISTS idx_feats_system ON public.feats (system_id);

CREATE INDEX IF NOT EXISTS idx_feats_user ON public.feats (user_id);

CREATE INDEX IF NOT EXISTS idx_feats_charge ON public.feats (charge_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feats_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feats_owned
    AFTER DELETE ON public.feats
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.charges", "columns": ["charge_id"] }
    ]');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feats_owned_on_update'
  ) THEN
    CREATE TRIGGER trg_cleanup_feats_owned_on_update
    AFTER UPDATE ON public.feats
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows_on_update('[
      { "table": "public.charges", "columns": ["charge_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEAT — EFFECTS (OWNED)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_effects (
  feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  effect_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feat_id, effect_id)
);

ALTER TABLE feat_effects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_effects_feat ON public.feat_effects (feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_effects_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_effects_owned
    AFTER DELETE ON public.feat_effects
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.effects", "columns": ["effect_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEAT — MODIFIER GRANTS
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_modifier_grants (
  feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  modifier_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feat_id, modifier_grant_id)
);

ALTER TABLE feat_modifier_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_modifier_grants_feat ON public.feat_modifier_grants (feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_modifier_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_modifier_grants_owned
    AFTER DELETE ON public.feat_modifier_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.modifier_grants", "columns": ["modifier_grant_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEAT — SPELL GRANTS
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_spell_grants (
  feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  spell_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feat_id, spell_grant_id)
);

ALTER TABLE feat_spell_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_spell_grants_feat ON public.feat_spell_grants (feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_spell_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_spell_grants_owned
    AFTER DELETE ON public.feat_spell_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.spell_grants", "columns": ["spell_grant_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEAT — SENSE GRANTS
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_sense_grants (
  feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sense_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feat_id, sense_grant_id)
);

ALTER TABLE feat_sense_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_sense_grants_feat ON public.feat_sense_grants (feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_sense_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_sense_grants_owned
    AFTER DELETE ON public.feat_sense_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.sense_grants", "columns": ["sense_grant_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEAT — PROFICIENCY GRANTS
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_proficiency_grants (
  feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  proficiency_grant_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feat_id, proficiency_grant_id)
);

ALTER TABLE feat_proficiency_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_proficiency_grants_feat ON public.feat_proficiency_grants (feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_proficiency_grants_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_proficiency_grants_owned
    AFTER DELETE ON public.feat_proficiency_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.proficiency_grants", "columns": ["proficiency_grant_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
* FEAT — FEATURES (OWNED)
* ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.feat_features (
  feat_id uuid NOT NULL REFERENCES public.feats (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  feature_id uuid NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (feat_id, feature_id)
);

ALTER TABLE feat_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feat_features_feat ON public.feat_features (feat_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_feat_features_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_feat_features_owned
    AFTER DELETE ON public.feat_features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.features", "columns": ["feature_id"] }
    ]');
  END IF;
END;
$$;
-- END INCLUDE: src\domains\subjects\tables\feats.sql
-- BEGIN INCLUDE: src\domains\subjects\tables\races.sql
/* ──────────────────────────────────────────────
 * RACES — ROOT
 *
 * Intent:
 *   Top-level race definition. Can represent a
 *   base race or a subrace.
 *
 * Cardinality:
 *   systems 1 ──▶ N races
 *
 * Ownership:
 *   races → details (owned)
 *   races → features (owned via bridge)
 *   races → speeds (owned)
 *   races → ancestry (owned subtree, BASE only)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.races (
  id uuid PRIMARY KEY,
  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  user_id uuid REFERENCES auth.users(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  quote text,
  description text,

  category text NOT NULL,              -- RaceCategoryCode
  playable boolean,                    -- BASE only

  parent_race_id uuid                  -- SUBRACE only
    REFERENCES public.races(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  is_master boolean,

  size_code text,                      -- SizeCode
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT races_category_chk CHECK (
    category IN ('BASE', 'SUBRACE')
  ),
  CONSTRAINT races_category_payload_chk CHECK (
    (category = 'BASE' AND parent_race_id IS NULL AND playable IS NOT NULL AND size_code IS NOT NULL)
    OR (category = 'SUBRACE' AND parent_race_id IS NOT NULL AND playable IS NULL)
  )
);

ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;

SELECT public.apply_system_derived_policies('races');

CREATE INDEX IF NOT EXISTS idx_races_system
  ON public.races(system_id);

CREATE INDEX IF NOT EXISTS idx_races_parent
  ON public.races(parent_race_id);



/* ──────────────────────────────────────────────
 * RACE — DETAILS (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.race_details (
  race_id uuid NOT NULL
    REFERENCES public.races(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  detail_id uuid NOT NULL
    REFERENCES public.details(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  sort_order integer NOT NULL,

  PRIMARY KEY (race_id, detail_id)
);

ALTER TABLE public.race_details ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_race_details_race
  ON public.race_details(race_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_race_details_owned'
      AND tgrelid = 'public.race_details'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_race_details_owned
    AFTER DELETE ON public.race_details
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.details", "columns": ["detail_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * RACE — FEATURES (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.race_features (
  race_id uuid NOT NULL
    REFERENCES public.races(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  feature_id uuid NOT NULL,

  sort_order integer NOT NULL,

  PRIMARY KEY (race_id, feature_id)
);

ALTER TABLE public.race_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_race_features_race
  ON public.race_features(race_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_race_features_owned'
      AND tgrelid = 'public.race_features'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_race_features_owned
    AFTER DELETE ON public.race_features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.features", "columns": ["feature_id"] }
    ]');
  END IF;
END;
$$;

/* ──────────────────────────────────────────────
 * RACE — SPEEDS (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.race_speeds (
  race_id uuid NOT NULL
    REFERENCES public.races(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  speed_id uuid NOT NULL REFERENCES public.speeds(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  amount integer NOT NULL,
  unit_code text NOT NULL,

  PRIMARY KEY (race_id, speed_id)
);

ALTER TABLE public.race_speeds ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_race_speeds_race
  ON public.race_speeds(race_id);

/* ──────────────────────────────────────────────
 * RACE — ANCESTRY (BASE ONLY)
 *
 * Intent:
 *   Optional ancestry container for base races.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.race_ancestries (
  id uuid PRIMARY KEY,
  race_id uuid NOT NULL
    REFERENCES public.races(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  description text
);

ALTER TABLE public.race_ancestries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_race_ancestries_race
  ON public.race_ancestries(race_id);

/* ──────────────────────────────────────────────
 * RACE — ANCESTRY OPTIONS (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.race_ancestry_options (
  id uuid PRIMARY KEY,
  ancestry_id uuid NOT NULL
    REFERENCES public.race_ancestries(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  description text,
  sort_order integer NOT NULL
);

ALTER TABLE public.race_ancestry_options ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_race_ancestry_options_ancestry
  ON public.race_ancestry_options(ancestry_id);

/* ──────────────────────────────────────────────
 * RACE — ANCESTRY OPTION FEATURES (OWNED)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.race_ancestry_option_features (
  ancestry_option_id uuid NOT NULL
    REFERENCES public.race_ancestry_options(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  feature_id uuid NOT NULL,

  sort_order integer NOT NULL,

  PRIMARY KEY (ancestry_option_id, feature_id)
);

ALTER TABLE public.race_ancestry_option_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_race_ancestry_option_features_option
  ON public.race_ancestry_option_features(ancestry_option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_race_ancestry_option_features_owned'
      AND tgrelid = 'public.race_ancestry_option_features'::regclass
  ) THEN
    CREATE TRIGGER trg_cleanup_race_ancestry_option_features_owned
    AFTER DELETE ON public.race_ancestry_option_features
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.features", "columns": ["feature_id"] }
    ]');
  END IF;
END;
$$;
-- END INCLUDE: src\domains\subjects\tables\races.sql
-- BEGIN INCLUDE: src\domains\subjects\tables\spells.sql
/* ──────────────────────────────────────────────
 * SPELLS — ROOT
 *
 * Intent:
 *   Spell is a top-level authored subject that defines
 *   a castable magical effect with level, school,
 *   casting time, and owned effects.
 *
 * Cardinality:
 *   systems 1 ──▶ N spells
 *
 * Ownership:
 *   spells → spell_effects (owned)
 *
 * References:
 *   spells → magic_schools
 *   spells → classes (many-to-many)
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.spells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  system_id uuid NOT NULL
    REFERENCES public.systems(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,

  label text NOT NULL,
  description text NOT NULL,

  level integer NOT NULL,

  magic_school_id uuid NOT NULL
    REFERENCES public.magic_schools(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  casting_time_unit text NOT NULL,  -- CastingTimeUnit
  casting_time_amount integer NOT NULL,

  material_description text,

  is_master boolean,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.apply_system_derived_policies('spells');

ALTER TABLE public.spells ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_spells_system
  ON public.spells(system_id);

CREATE INDEX IF NOT EXISTS idx_spells_user
  ON public.spells(user_id);

CREATE INDEX IF NOT EXISTS idx_spells_level
  ON public.spells(level);

CREATE INDEX IF NOT EXISTS idx_spells_school
  ON public.spells(magic_school_id);

CREATE TABLE IF NOT EXISTS public.spell_attributes (
  spell_id uuid NOT NULL
    REFERENCES public.spells(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  attribute_code text NOT NULL,
  sort_order integer NOT NULL,

  PRIMARY KEY (spell_id, attribute_code)
);

CREATE INDEX IF NOT EXISTS idx_spell_attributes_spell
  ON public.spell_attributes(spell_id);

ALTER TABLE public.spell_attributes ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * SPELL — CLASSES
 *
 * Intent:
 *   Declares which classes can cast this spell.
 *
 * Ownership:
 *   NOT owned. Classes are vocabulary-level entities.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.spell_classes (
  spell_id uuid NOT NULL
    REFERENCES public.spells(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  class_id uuid NOT NULL,

  PRIMARY KEY (spell_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_spell_classes_spell
  ON public.spell_classes(spell_id);

CREATE INDEX IF NOT EXISTS idx_spell_classes_class
  ON public.spell_classes(class_id);

ALTER TABLE public.spell_classes ENABLE ROW LEVEL SECURITY;

/* ──────────────────────────────────────────────
 * SPELL — EFFECTS (OWNED)
 *
 * Intent:
 *   Associates authored effects to the spell.
 *   Effects may scale by SPELL_CAST_LEVEL.
 *
 * Ownership:
 *   spell_effects owns effect rows.
 * ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.spell_effects (
  spell_id uuid NOT NULL
    REFERENCES public.spells(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  effect_id uuid NOT NULL,

  sort_order integer NOT NULL,

  PRIMARY KEY (spell_id, effect_id)
);

CREATE INDEX IF NOT EXISTS idx_spell_effects_spell
  ON public.spell_effects(spell_id);

ALTER TABLE public.spell_effects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cleanup_spell_effects_owned'
  ) THEN
    CREATE TRIGGER trg_cleanup_spell_effects_owned
    AFTER DELETE ON public.spell_effects
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_owned_rows('[
      { "table": "public.effects", "columns": ["effect_id"] }
    ]');
  END IF;
END;
$$;
-- END INCLUDE: src\domains\subjects\tables\spells.sql
-- BEGIN INCLUDE: src\domains\bootstrap\constraints\cross_domain_foreign_keys.sql
/* ============================================================================
 * Cross-domain foreign keys deferred for empty-database bootstrap.
 *
 * These constraints are intentionally added after all root tables exist so the
 * schema can be created on a fresh database without relying on impossible file
 * ordering across cyclic domains.
 * ========================================================================== */

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'starting_equipment_option_item_equipment_equipment_id_fkey') THEN
    ALTER TABLE public.starting_equipment_option_item_equipment
      ADD CONSTRAINT starting_equipment_option_item_equipment_equipment_id_fkey
      FOREIGN KEY (equipment_id) REFERENCES public.equipment(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'damages_class_id_fkey') THEN
    ALTER TABLE public.damages
      ADD CONSTRAINT damages_class_id_fkey
      FOREIGN KEY (class_id) REFERENCES public.classes(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_class_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_class_id_fkey
      FOREIGN KEY (class_id) REFERENCES public.classes(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_feature_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_spell_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_spell_id_fkey
      FOREIGN KEY (spell_id) REFERENCES public.spells(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_equipment_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_equipment_id_fkey
      FOREIGN KEY (equipment_id) REFERENCES public.equipment(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_feat_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_feat_id_fkey
      FOREIGN KEY (feat_id) REFERENCES public.feats(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_race_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_race_id_fkey
      FOREIGN KEY (race_id) REFERENCES public.races(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_background_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_background_id_fkey
      FOREIGN KEY (background_id) REFERENCES public.backgrounds(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_option_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_option_id_fkey
      FOREIGN KEY (option_id) REFERENCES public.options(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_subrace_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_subrace_id_fkey
      FOREIGN KEY (subrace_id) REFERENCES public.races(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_subclass_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_subclass_id_fkey
      FOREIGN KEY (subclass_id) REFERENCES public.classes(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_resource_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_resource_id_fkey
      FOREIGN KEY (resource_id) REFERENCES public.class_resources(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_body_selection_items_ancestry_option_id_fkey') THEN
    ALTER TABLE public.facet_body_selection_items
      ADD CONSTRAINT facet_body_selection_items_ancestry_option_id_fkey
      FOREIGN KEY (ancestry_option_id) REFERENCES public.race_ancestry_options(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_class_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_class_id_fkey
      FOREIGN KEY (class_id) REFERENCES public.classes(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_feature_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_spell_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_spell_id_fkey
      FOREIGN KEY (spell_id) REFERENCES public.spells(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_equipment_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_equipment_id_fkey
      FOREIGN KEY (equipment_id) REFERENCES public.equipment(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_feat_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_feat_id_fkey
      FOREIGN KEY (feat_id) REFERENCES public.feats(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_race_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_race_id_fkey
      FOREIGN KEY (race_id) REFERENCES public.races(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_background_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_background_id_fkey
      FOREIGN KEY (background_id) REFERENCES public.backgrounds(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_option_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_option_id_fkey
      FOREIGN KEY (option_id) REFERENCES public.options(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_subrace_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_subrace_id_fkey
      FOREIGN KEY (subrace_id) REFERENCES public.races(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_subclass_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_subclass_id_fkey
      FOREIGN KEY (subclass_id) REFERENCES public.classes(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_resource_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_resource_id_fkey
      FOREIGN KEY (resource_id) REFERENCES public.class_resources(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_exists_selection_items_ancestry_option_id_fkey') THEN
    ALTER TABLE public.facet_exists_selection_items
      ADD CONSTRAINT facet_exists_selection_items_ancestry_option_id_fkey
      FOREIGN KEY (ancestry_option_id) REFERENCES public.race_ancestry_options(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_predicate_spell_items_spell_id_fkey') THEN
    ALTER TABLE public.facet_predicate_spell_items
      ADD CONSTRAINT facet_predicate_spell_items_spell_id_fkey
      FOREIGN KEY (spell_id) REFERENCES public.spells(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_predicate_feat_items_feat_id_fkey') THEN
    ALTER TABLE public.facet_predicate_feat_items
      ADD CONSTRAINT facet_predicate_feat_items_feat_id_fkey
      FOREIGN KEY (feat_id) REFERENCES public.feats(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_predicate_feature_items_feature_id_fkey') THEN
    ALTER TABLE public.facet_predicate_feature_items
      ADD CONSTRAINT facet_predicate_feature_items_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_predicate_option_items_option_id_fkey') THEN
    ALTER TABLE public.facet_predicate_option_items
      ADD CONSTRAINT facet_predicate_option_items_option_id_fkey
      FOREIGN KEY (option_id) REFERENCES public.options(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facet_predicate_equipment_items_equipment_id_fkey') THEN
    ALTER TABLE public.facet_predicate_equipment_items
      ADD CONSTRAINT facet_predicate_equipment_items_equipment_id_fkey
      FOREIGN KEY (equipment_id) REFERENCES public.equipment(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_feat_grants_feat_grant_id_fkey') THEN
    ALTER TABLE public.feature_feat_grants
      ADD CONSTRAINT feature_feat_grants_feat_grant_id_fkey
      FOREIGN KEY (feat_grant_id) REFERENCES public.feat_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_modifier_grants_modifier_grant_id_fkey') THEN
    ALTER TABLE public.feature_modifier_grants
      ADD CONSTRAINT feature_modifier_grants_modifier_grant_id_fkey
      FOREIGN KEY (modifier_grant_id) REFERENCES public.modifier_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_proficiency_grants_proficiency_grant_id_fkey') THEN
    ALTER TABLE public.feature_proficiency_grants
      ADD CONSTRAINT feature_proficiency_grants_proficiency_grant_id_fkey
      FOREIGN KEY (proficiency_grant_id) REFERENCES public.proficiency_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_sense_grants_sense_grant_id_fkey') THEN
    ALTER TABLE public.feature_sense_grants
      ADD CONSTRAINT feature_sense_grants_sense_grant_id_fkey
      FOREIGN KEY (sense_grant_id) REFERENCES public.sense_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_spell_grants_spell_grant_id_fkey') THEN
    ALTER TABLE public.feature_spell_grants
      ADD CONSTRAINT feature_spell_grants_spell_grant_id_fkey
      FOREIGN KEY (spell_grant_id) REFERENCES public.spell_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_options_option_id_fkey') THEN
    ALTER TABLE public.feature_options
      ADD CONSTRAINT feature_options_option_id_fkey
      FOREIGN KEY (option_id) REFERENCES public.options(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'option_feat_grants_feat_grant_id_fkey') THEN
    ALTER TABLE public.option_feat_grants
      ADD CONSTRAINT option_feat_grants_feat_grant_id_fkey
      FOREIGN KEY (feat_grant_id) REFERENCES public.feat_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'option_modifier_grants_modifier_grant_id_fkey') THEN
    ALTER TABLE public.option_modifier_grants
      ADD CONSTRAINT option_modifier_grants_modifier_grant_id_fkey
      FOREIGN KEY (modifier_grant_id) REFERENCES public.modifier_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'option_proficiency_grants_proficiency_grant_id_fkey') THEN
    ALTER TABLE public.option_proficiency_grants
      ADD CONSTRAINT option_proficiency_grants_proficiency_grant_id_fkey
      FOREIGN KEY (proficiency_grant_id) REFERENCES public.proficiency_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'option_sense_grants_sense_grant_id_fkey') THEN
    ALTER TABLE public.option_sense_grants
      ADD CONSTRAINT option_sense_grants_sense_grant_id_fkey
      FOREIGN KEY (sense_grant_id) REFERENCES public.sense_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'option_spell_grants_spell_grant_id_fkey') THEN
    ALTER TABLE public.option_spell_grants
      ADD CONSTRAINT option_spell_grants_spell_grant_id_fkey
      FOREIGN KEY (spell_grant_id) REFERENCES public.spell_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_grant_feats_feat_id_fkey') THEN
    ALTER TABLE public.feat_grant_feats
      ADD CONSTRAINT feat_grant_feats_feat_id_fkey
      FOREIGN KEY (feat_id) REFERENCES public.feats(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_grant_scaling_level_feats_feat_id_fkey') THEN
    ALTER TABLE public.feat_grant_scaling_level_feats
      ADD CONSTRAINT feat_grant_scaling_level_feats_feat_id_fkey
      FOREIGN KEY (feat_id) REFERENCES public.feats(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spell_grants_class_id_fkey') THEN
    ALTER TABLE public.spell_grants
      ADD CONSTRAINT spell_grants_class_id_fkey
      FOREIGN KEY (class_id) REFERENCES public.classes(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spell_grant_spells_spell_id_fkey') THEN
    ALTER TABLE public.spell_grant_spells
      ADD CONSTRAINT spell_grant_spells_spell_id_fkey
      FOREIGN KEY (spell_id) REFERENCES public.spells(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spell_grant_scaling_level_spells_spell_id_fkey') THEN
    ALTER TABLE public.spell_grant_scaling_level_spells
      ADD CONSTRAINT spell_grant_scaling_level_spells_spell_id_fkey
      FOREIGN KEY (spell_id) REFERENCES public.spells(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sense_grants_class_id_fkey') THEN
    ALTER TABLE public.sense_grants
      ADD CONSTRAINT sense_grants_class_id_fkey
      FOREIGN KEY (class_id) REFERENCES public.classes(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'modifier_grant_payloads_numeric_class_id_fkey') THEN
    ALTER TABLE public.modifier_grant_payloads
      ADD CONSTRAINT modifier_grant_payloads_numeric_class_id_fkey
      FOREIGN KEY (numeric_class_id) REFERENCES public.classes(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proficiency_grant_equipment_equipment_id_fkey') THEN
    ALTER TABLE public.proficiency_grant_equipment
      ADD CONSTRAINT proficiency_grant_equipment_equipment_id_fkey
      FOREIGN KEY (equipment_id) REFERENCES public.equipment(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'background_proficiency_grants_proficiency_grant_id_fkey') THEN
    ALTER TABLE public.background_proficiency_grants
      ADD CONSTRAINT background_proficiency_grants_proficiency_grant_id_fkey
      FOREIGN KEY (proficiency_grant_id) REFERENCES public.proficiency_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'background_features_feature_id_fkey') THEN
    ALTER TABLE public.background_features
      ADD CONSTRAINT background_features_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_effects_effect_id_fkey') THEN
    ALTER TABLE public.feat_effects
      ADD CONSTRAINT feat_effects_effect_id_fkey
      FOREIGN KEY (effect_id) REFERENCES public.effects(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_modifier_grants_modifier_grant_id_fkey') THEN
    ALTER TABLE public.feat_modifier_grants
      ADD CONSTRAINT feat_modifier_grants_modifier_grant_id_fkey
      FOREIGN KEY (modifier_grant_id) REFERENCES public.modifier_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_spell_grants_spell_grant_id_fkey') THEN
    ALTER TABLE public.feat_spell_grants
      ADD CONSTRAINT feat_spell_grants_spell_grant_id_fkey
      FOREIGN KEY (spell_grant_id) REFERENCES public.spell_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_sense_grants_sense_grant_id_fkey') THEN
    ALTER TABLE public.feat_sense_grants
      ADD CONSTRAINT feat_sense_grants_sense_grant_id_fkey
      FOREIGN KEY (sense_grant_id) REFERENCES public.sense_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_proficiency_grants_proficiency_grant_id_fkey') THEN
    ALTER TABLE public.feat_proficiency_grants
      ADD CONSTRAINT feat_proficiency_grants_proficiency_grant_id_fkey
      FOREIGN KEY (proficiency_grant_id) REFERENCES public.proficiency_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feat_features_feature_id_fkey') THEN
    ALTER TABLE public.feat_features
      ADD CONSTRAINT feat_features_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_effects_effect_id_fkey') THEN
    ALTER TABLE public.equipment_effects
      ADD CONSTRAINT equipment_effects_effect_id_fkey
      FOREIGN KEY (effect_id) REFERENCES public.effects(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_modifier_grants_modifier_grant_id_fkey') THEN
    ALTER TABLE public.equipment_modifier_grants
      ADD CONSTRAINT equipment_modifier_grants_modifier_grant_id_fkey
      FOREIGN KEY (modifier_grant_id) REFERENCES public.modifier_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_features_feature_id_fkey') THEN
    ALTER TABLE public.equipment_features
      ADD CONSTRAINT equipment_features_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_proficiency_grants_proficiency_grant_id_fkey') THEN
    ALTER TABLE public.class_proficiency_grants
      ADD CONSTRAINT class_proficiency_grants_proficiency_grant_id_fkey
      FOREIGN KEY (proficiency_grant_id) REFERENCES public.proficiency_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_features_feature_id_fkey') THEN
    ALTER TABLE public.class_features
      ADD CONSTRAINT class_features_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_multiclass_proficiency_grants_proficiency_grant_id_fkey') THEN
    ALTER TABLE public.class_multiclass_proficiency_grants
      ADD CONSTRAINT class_multiclass_proficiency_grants_proficiency_grant_id_fkey
      FOREIGN KEY (proficiency_grant_id) REFERENCES public.proficiency_grants(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spell_classes_class_id_fkey') THEN
    ALTER TABLE public.spell_classes
      ADD CONSTRAINT spell_classes_class_id_fkey
      FOREIGN KEY (class_id) REFERENCES public.classes(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spell_effects_effect_id_fkey') THEN
    ALTER TABLE public.spell_effects
      ADD CONSTRAINT spell_effects_effect_id_fkey
      FOREIGN KEY (effect_id) REFERENCES public.effects(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'race_features_feature_id_fkey') THEN
    ALTER TABLE public.race_features
      ADD CONSTRAINT race_features_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'race_ancestry_option_features_feature_id_fkey') THEN
    ALTER TABLE public.race_ancestry_option_features
      ADD CONSTRAINT race_ancestry_option_features_feature_id_fkey
      FOREIGN KEY (feature_id) REFERENCES public.features(id)
      ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;
-- END INCLUDE: src\domains\bootstrap\constraints\cross_domain_foreign_keys.sql

SELECT
  public.apply_updated_at_triggers ();
-- END INCLUDE: src\domains\utils\create_database.sql
