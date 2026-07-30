ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bio text,
ADD CONSTRAINT profiles_full_name_length
  CHECK (full_name IS NULL OR char_length(full_name) <= 100),
ADD CONSTRAINT profiles_bio_length
  CHECK (bio IS NULL OR char_length(bio) <= 500);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users AS auth_user
    LEFT JOIN public.profiles AS profile ON profile.id = auth_user.id
    WHERE profile.id IS NULL
      OR profile.username IS NULL
      OR char_length(profile.username) NOT BETWEEN 3 AND 30
      OR profile.username !~ '^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*$'
  ) THEN
    RAISE EXCEPTION 'Cannot require profile usernames until every auth user has a populated valid profile.';
  END IF;
END;
$$;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS username_length,
  ADD CONSTRAINT profiles_username_length CHECK (char_length(username) BETWEEN 3 AND 30),
  ADD CONSTRAINT profiles_username_format CHECK (username ~ '^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*$'),
  ALTER COLUMN username SET NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SET search_path = pg_catalog, public
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NEW.raw_user_meta_data ->> 'username' IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    trim(NEW.raw_user_meta_data ->> 'username'),
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

DROP POLICY IF EXISTS "Users can select own profile." ON public.profiles;

CREATE POLICY "Users can select own profile." ON public.profiles
FOR SELECT
TO authenticated
USING (
  (
    SELECT
      auth.uid()
  ) = id
);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;

CREATE POLICY "Users can insert their own profile." ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  (
    SELECT
      auth.uid()
  ) = id
);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

CREATE POLICY "Users can update own profile." ON public.profiles
FOR UPDATE
TO authenticated
USING (
  (
    SELECT
      auth.uid()
  ) = id
)
WITH CHECK (
  (
    SELECT
      auth.uid()
  ) = id
);

ALTER TABLE public.classes
DROP CONSTRAINT classes_user_id_fkey;

ALTER TABLE public.classes
ADD CONSTRAINT classes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

DO $$
DECLARE
  table_name text;
  column_name text;
  constraint_name text;
  is_deferrable boolean;
  is_deferred boolean;
BEGIN
  FOR table_name, column_name IN
    VALUES
      ('character_ability_adjustments', 'created_by'),
      ('character_ability_adjustments', 'updated_by'),
      ('character_saving_throw_adjustments', 'created_by'),
      ('character_saving_throw_adjustments', 'updated_by'),
      ('character_skill_adjustments', 'created_by'),
      ('character_skill_adjustments', 'updated_by'),
      ('character_passive_adjustments', 'created_by'),
      ('character_passive_adjustments', 'updated_by'),
      ('character_sense_adjustments', 'created_by'),
      ('character_sense_adjustments', 'updated_by'),
      ('character_movement_adjustments', 'created_by'),
      ('character_movement_adjustments', 'updated_by'),
      ('character_hitpoint_adjustments', 'created_by'),
      ('character_hitpoint_adjustments', 'updated_by'),
      ('character_spell_adjustments', 'created_by'),
      ('character_spell_adjustments', 'updated_by'),
      ('character_item_adjustments', 'created_by'),
      ('character_item_adjustments', 'updated_by'),
      ('character_companion_adjustments', 'created_by'),
      ('character_companion_adjustments', 'updated_by'),
      ('character_defense_additions', 'created_by'),
      ('character_defense_additions', 'updated_by'),
      ('character_proficiency_additions', 'created_by'),
      ('character_proficiency_additions', 'updated_by'),
      ('character_sheet_preferences', 'updated_by'),
      ('character_spell_customizations', 'created_by'),
      ('character_spell_customizations', 'updated_by'),
      ('character_sheet_resource_usage', 'created_by'),
      ('character_sheet_resource_usage', 'updated_by')
  LOOP
    SELECT constraint_definition.conname, constraint_definition.condeferrable, constraint_definition.condeferred
    INTO constraint_name, is_deferrable, is_deferred
    FROM pg_constraint AS constraint_definition
    JOIN pg_attribute AS attribute
      ON attribute.attrelid = constraint_definition.conrelid
      AND attribute.attnum = ANY (constraint_definition.conkey)
    WHERE constraint_definition.conrelid = format('public.%I', table_name)::regclass
      AND constraint_definition.contype = 'f'
      AND constraint_definition.confrelid = 'auth.users'::regclass
      AND attribute.attname = column_name;

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', table_name, constraint_name);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE%s%s',
      table_name,
      constraint_name,
      column_name,
      CASE WHEN is_deferrable THEN ' DEFERRABLE' ELSE '' END,
      CASE WHEN is_deferred THEN ' INITIALLY DEFERRED' ELSE '' END
    );
  END LOOP;
END;
$$;
