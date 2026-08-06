ALTER TABLE public.profiles
ALTER COLUMN username DROP NOT NULL;

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
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_invitation_completed ON auth.users;
DROP FUNCTION IF EXISTS public.handle_invitation_completion();

INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT
  auth_user.id,
  auth_user.raw_user_meta_data ->> 'full_name',
  auth_user.raw_user_meta_data ->> 'avatar_url'
FROM auth.users AS auth_user
ON CONFLICT (id) DO NOTHING;
