/*
 * PUBLIC API ACCESS
 *
 * apps/web uses Supabase for Auth/session only. Product data is served through
 * apps/apis and server-side packages, so browser Supabase roles should not be
 * able to discover or call database objects directly through REST or GraphQL.
 */

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

REVOKE USAGE, SELECT, UPDATE
  ON ALL SEQUENCES IN SCHEMA public
  FROM anon, authenticated;

REVOKE EXECUTE
  ON ALL ROUTINES IN SCHEMA public
  FROM public, anon, authenticated;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.set_admin_claims(jsonb) TO supabase_auth_admin;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
      AND c.relname <> 'authored_definition_creation_rate_limits'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      'No direct browser API access',
      r.schema_name,
      r.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      'No direct browser API access',
      r.schema_name,
      r.table_name
    );
  END LOOP;
END;
$$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES
  FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT, UPDATE ON SEQUENCES
  FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS
  FROM public, anon, authenticated;
