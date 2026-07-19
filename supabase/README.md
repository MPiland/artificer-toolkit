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

## Canonical references

- [Persistence and Kysely](../docs/architecture/persistence.md)
- [Data lifecycle](../docs/architecture/data-lifecycle.md)
- [Architecture overview](../docs/architecture/overview.md)
