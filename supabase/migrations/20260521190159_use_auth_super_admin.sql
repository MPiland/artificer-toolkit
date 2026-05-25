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

UPDATE auth.users
SET is_super_admin = true
WHERE lower(email) = 'artificertoolkit@gmail.com';

DROP TABLE IF EXISTS public.admins;
