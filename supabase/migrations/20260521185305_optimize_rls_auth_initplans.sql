/* Optimize RLS auth checks so auth.uid()/auth.jwt() run once per statement. */

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

  EXECUTE format(
    $fmt$
      CREATE POLICY "Users can select own rows" ON public.%s
      FOR SELECT TO authenticated
      USING (user_id = (SELECT auth.uid()) OR (%s));
    $fmt$,
    safe_table, admin_check
  );

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

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'backgrounds',
    'classes',
    'creatures',
    'equipment',
    'feats',
    'races',
    'spells',
    'vehicles'
  ] LOOP
    PERFORM public.apply_system_derived_policies(target_table);
  END LOOP;

  FOREACH target_table IN ARRAY ARRAY[
    'alignments',
    'condition_types',
    'currencies',
    'damage_types',
    'heritages',
    'languages',
    'lifestyles',
    'magic_schools',
    'passives',
    'rarities',
    'senses',
    'skills',
    'speeds',
    'challenge_ratings',
    'creature_types',
    'terrains'
  ] LOOP
    PERFORM public.apply_system_vocabulary_policies(target_table);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "Systems are readable by owner or public." ON public.systems;
CREATE POLICY "Systems are readable by owner or public."
  ON public.systems FOR SELECT TO authenticated
  USING (
    user_id IS NULL
    OR user_id = (SELECT auth.uid())
    OR ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Users can insert own systems." ON public.systems;
CREATE POLICY "Users can insert own systems."
  ON public.systems FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Users can update own systems." ON public.systems;
CREATE POLICY "Users can update own systems."
  ON public.systems FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Users can delete own systems." ON public.systems;
CREATE POLICY "Users can delete own systems."
  ON public.systems FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Users can select own character builder drafts" ON public.character_builder_drafts;
CREATE POLICY "Users can select own character builder drafts"
  ON public.character_builder_drafts FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own character builder drafts" ON public.character_builder_drafts;
CREATE POLICY "Users can insert own character builder drafts"
  ON public.character_builder_drafts FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own character builder drafts" ON public.character_builder_drafts;
CREATE POLICY "Users can update own character builder drafts"
  ON public.character_builder_drafts FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own character builder drafts" ON public.character_builder_drafts;
CREATE POLICY "Users can delete own character builder drafts"
  ON public.character_builder_drafts FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Character owners can read" ON public.characters;
CREATE POLICY "Character owners can read"
  ON public.characters FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Character owners can insert" ON public.characters;
CREATE POLICY "Character owners can insert"
  ON public.characters FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Character owners can update" ON public.characters;
CREATE POLICY "Character owners can update"
  ON public.characters FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

DROP POLICY IF EXISTS "Character owners can delete" ON public.characters;
CREATE POLICY "Character owners can delete"
  ON public.characters FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR ((SELECT auth.jwt())::jsonb -> 'app_metadata' ->> 'admin') = 'true'
  );

REVOKE EXECUTE ON FUNCTION public.apply_direct_ownership_policies(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_system_derived_policies(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_system_vocabulary_policies(text) FROM PUBLIC, anon, authenticated;
