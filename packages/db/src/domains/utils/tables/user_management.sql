/* ──────────────────────────────────────────────
 * USER MANAGEMENT
 *
 * Defines:
 *   - profiles              (private account profile, mirrors auth.users)
 *   - handle_new_user()     (trigger: create a profile for every auth user)
 *   - set_admin_claims()    (auth hook: injects auth.users.is_super_admin into JWT)
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
  username   text,
  full_name  text,
  bio        text,
  avatar_url text,
  website    text,

  CONSTRAINT profiles_username_length CHECK (char_length(username) BETWEEN 3 AND 30),
  CONSTRAINT profiles_username_format CHECK (username ~ '^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*$'),
  CONSTRAINT profiles_full_name_length CHECK (full_name IS NULL OR char_length(full_name) <= 100),
  CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR char_length(bio) <= 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can select own profile." ON public.profiles;
CREATE POLICY "Users can select own profile."
  ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);


/* ──────────────────────────────────────────────
 * ────────────────────────────────────────────── */

/* ──────────────────────────────────────────────
 * TRIGGERS: create profiles for every auth user
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SET search_path = pg_catalog, public
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  profile_username text := NULLIF(trim(NEW.raw_user_meta_data ->> 'username'), '');
BEGIN
  IF lower(profile_username) IN (
    'admin', 'moderator', 'support', 'system', 'root', 'artificer', 'artificer_toolkit'
  ) THEN
    RAISE EXCEPTION 'Username is reserved.';
  END IF;

  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    profile_username,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();

INSERT INTO public.profiles (id, username, full_name, avatar_url)
SELECT
  auth_user.id,
  NULLIF(trim(auth_user.raw_user_meta_data ->> 'username'), ''),
  auth_user.raw_user_meta_data ->> 'full_name',
  auth_user.raw_user_meta_data ->> 'avatar_url'
FROM auth.users AS auth_user
ON CONFLICT (id) DO NOTHING;


/* ──────────────────────────────────────────────
 * AUTH HOOK: inject is_super_admin into JWT
 * ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.set_admin_claims(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  claims   jsonb;
  is_admin boolean;
BEGIN
  claims := COALESCE(event -> 'claims', '{}');

  SELECT COALESCE(u.is_super_admin, false)
  INTO is_admin
  FROM auth.users u
  WHERE u.id = (event ->> 'user_id')::uuid;

  is_admin := COALESCE(is_admin, false);

  claims := jsonb_set(
    claims,
    '{app_metadata}',
    COALESCE(claims -> 'app_metadata', '{}') - 'admin'
  );

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

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.set_admin_claims(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_claims(jsonb) TO supabase_auth_admin;


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
  admin_check text := '((SELECT auth.jwt())::jsonb -> ''app_metadata'' ->> ''admin'') = ''true''';
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
      USING (user_id = (SELECT auth.uid()) OR (%s));
    $fmt$,
    safe_table, admin_check
  );

  -- INSERT
  EXECUTE format(
    $fmt$
      CREATE POLICY "Users can insert own rows" ON public.%s
      FOR INSERT TO authenticated
      WITH CHECK (
        (user_id = (SELECT auth.uid()) AND COALESCE(is_master, false) = false)
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
        (user_id = (SELECT auth.uid()) AND COALESCE(is_master, false) = false)
        OR (%s)
      )
      WITH CHECK (
        (user_id = (SELECT auth.uid()) AND COALESCE(is_master, false) = false)
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
        (user_id = (SELECT auth.uid()) AND COALESCE(is_master, false) = false)
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
  admin_check text := '((SELECT auth.jwt())::jsonb -> ''app_metadata'' ->> ''admin'') = ''true''';
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
              OR s.user_id = (SELECT auth.uid())
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
            AND s.user_id = (SELECT auth.uid())
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
            AND s.user_id = (SELECT auth.uid())
            AND %s.is_master = false
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM systems s
          WHERE s.id = %s.system_id
            AND s.user_id = (SELECT auth.uid())
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
            AND s.user_id = (SELECT auth.uid())
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
 * Writes are limited to the owner of the system or super admins.
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
  admin_check text := '((SELECT auth.jwt())::jsonb -> ''app_metadata'' ->> ''admin'') = ''true''';
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
              OR s.user_id = (SELECT auth.uid())
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
              s.user_id = (SELECT auth.uid())
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
              s.user_id = (SELECT auth.uid())
              OR %s
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.systems s
          WHERE s.id = %s.system_id
            AND (
              s.user_id = (SELECT auth.uid())
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
              s.user_id = (SELECT auth.uid())
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
