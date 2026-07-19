# Database package

`packages/db` is the Kysely/Postgres persistence adapter for Supabase. It owns database clients, generated database types, repositories, domain upserts, hydration, seed/source-data loaders, and database-local utilities.

## Owns and does not own

- `src/client.ts` creates a Kysely Postgres client and provides `withUserContext` for Supabase RLS claim context.
- `src/types` derives Kysely types from the generated Supabase database contract.
- `src/repositories` exposes authored-shaped repository contracts; domain folders implement hydration and persistence for subjects, features, grants, effects, and character records.
- Does not own API DTOs, HTTP/auth procedure policy, frontend form state, or game-rule orchestration.

## Key flow

An application service validates/compiles an authored record, calls a repository/upsert with a `DBLike`, and receives persisted state. Transactional operations reuse an incoming Kysely transaction or open one at the outermost boundary. Aggregate upserts replace owned relation rows; reads hydrate them back into authored-shaped objects.

The eight authored root domains have stable `authored_definitions` identities and immutable full-payload revisions. Normalized domain rows are active query projections. Projection replacement and revision promotion must share one transaction. Nested features, options, grants, and effects are owned by their root and are not independent revision roots.

`withUserContext` sets `request.jwt.claim.sub` inside a transaction before RLS-sensitive work. Node-runtime queries use a separate allow-listed query utility rather than accepting arbitrary table/column identifiers.

## Invariants

- Repositories are the persistence seam: callers should not depend on raw Kysely row layouts.
- Kysely owns application writes; Supabase migrations own schema, constraints, RLS, and bootstrap SQL.
- Upsert replacement semantics must remove stale child/link rows before inserting the current authored shape, within one transaction.
- Never start or commit a nested transaction when a `Transaction<Database>` is already supplied as `DBLike`.
- Keep authored hydration distinct from compiled engine data; compilation belongs to shared/functions.

## Focused validation

Use repository tests under `src/__tests__` (especially round-trip, unsupported-upsert, seed, and character tests) and `yarn workspace @artificer-toolkit/db typecheck`. Use root `yarn audit:srd` for corpus diagnostics, `yarn test:srd:integration` for rollback-isolated full-corpus persistence, and `yarn test:character-sheet:integration` for Sheet patch persistence. Integration scripts require local Supabase/Postgres and reject remote targets; run seed/reset commands only when the data path is in scope.

## Canonical references

- [Persistence and Kysely](../../docs/architecture/persistence.md)
- [Data lifecycle](../../docs/architecture/data-lifecycle.md)
- [Architecture overview](../../docs/architecture/overview.md)
- [Supabase operations](../../supabase/README.md)
