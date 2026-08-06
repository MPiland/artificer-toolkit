-- New accounts require one canonical username. Invitation-created auth users
-- and legacy accounts may retain a temporary null until they claim one.

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

UPDATE public.profiles AS profile
SET username = NULLIF(trim(auth_user.raw_user_meta_data ->> 'username'), '')
FROM auth.users AS auth_user
WHERE profile.id = auth_user.id
  AND profile.username IS NULL
  AND NULLIF(trim(auth_user.raw_user_meta_data ->> 'username'), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles AS claimed_profile
    WHERE claimed_profile.id <> profile.id
      AND lower(claimed_profile.username) =
        lower(NULLIF(trim(auth_user.raw_user_meta_data ->> 'username'), ''))
  );

UPDATE auth.users AS auth_user
SET raw_app_meta_data = COALESCE(auth_user.raw_app_meta_data, '{}'::jsonb)
  - 'registration_completed'
WHERE auth_user.invited_at IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = auth_user.id
      AND profile.username IS NULL
  );
