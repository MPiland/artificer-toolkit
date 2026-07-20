# Supabase project

`supabase/` is the schema and local-operations source for the Postgres/Auth platform. It is not the application data boundary; `apps/apis` and `packages/db` own request and persistence behavior.

## Owns and does not own

- `migrations/` is the ordered schema, constraint, RLS, and policy history. New schema behavior belongs in a migration.
- `config.toml` defines local API, database, Studio, Auth, storage, and seed settings. Local DB/API/Studio ports are 54322, 54321, and 54323.
- `seed.sql` is loaded after migrations during local reset; package seed scripts populate authored and SRD data through the DB layer.
- Does not own TypeScript repository hydration, tRPC routes, node maps, or engine rules.

## Key flow

Migration files establish the schema and RLS policies → local/remote Supabase applies them → `packages/db` connects through Kysely → `apps/apis` supplies authenticated user context → services persist or hydrate authored records.

## Invariants

- Treat migrations as append-only history; do not edit an applied migration to change live behavior.
- Preserve RLS and auth-claim assumptions used by `packages/db.withUserContext` and the API handler.
- Keep seed/bootstrap SQL and application upserts separate so application writes remain testable and transactional.

## Focused validation

Inspect the relevant migration and run the narrow DB/repository test first. For local schema work, verify with the Supabase CLI reset/diff workflow documented by the repository commands; confirm Docker/Supabase is running before diagnosing application auth or sheet failures.

## Closed-alpha authentication

`PUBLIC_SIGN_UP_ENABLED` controls application presentation and the application-initiated sign-up action. It defaults to disabled unless its server-only environment value is exactly `true`. Change the value in `apps/web/.env.local` for local work or in the hosted application environment for deployment, then restart or redeploy the application.

The application flag is not the security boundary: a client can call the public Supabase Auth API directly when Supabase permits sign-ups. During closed alpha and beta, configure the hosted Supabase project as follows:

1. In Authentication settings, disable **Allow new users to sign up**. Keep email/password sign-in and password recovery enabled for existing users, and keep anonymous sign-ins disabled.
2. In Authentication URL Configuration, set the production Site URL and add `https://<your-domain>/auth/confirmed` and `https://<your-domain>/update-password` to Redirect URLs.
3. In Authentication Email Templates, set the Invite user link to `{{ .SiteURL }}/auth/confirmed?token_hash={{ .TokenHash }}&type=invite`. The app verifies that token server-side, establishes the invitation session, and redirects the invitee to password setup.
4. Configure custom SMTP before inviting external testers; the default Supabase mail service is restricted and is not suitable for alpha delivery.
5. Invite testers from Authentication → Users → Add user → Send invitation. The application does not provide an admin invitation interface.

The invitation callback and `/update-password` remain enabled when public registration is disabled. If public registration is reopened later, enable both `PUBLIC_SIGN_UP_ENABLED=true` and the Supabase project signup setting. Do not place a Supabase secret/service-role key in web environment variables or client-side code.

## Canonical references

- [Persistence and Kysely](../docs/architecture/persistence.md)
- [Data lifecycle](../docs/architecture/data-lifecycle.md)
- [Architecture overview](../docs/architecture/overview.md)
