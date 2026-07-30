DO $$
BEGIN
  IF EXISTS (
    SELECT lower(username)
    FROM public.profiles
    GROUP BY lower(username)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce case-insensitive username uniqueness while case-only duplicates exist.';
  END IF;
END;
$$;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_key,
  DROP CONSTRAINT IF EXISTS profiles_username_format;

DROP INDEX IF EXISTS public.profiles_username_key;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
    CHECK (username ~ '^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*$');

CREATE UNIQUE INDEX profiles_username_key ON public.profiles (lower(username));

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
