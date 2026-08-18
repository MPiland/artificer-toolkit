# Database package

`packages/db` is the Kysely/Postgres persistence adapter for Supabase. It owns database clients, generated database types, repositories, domain upserts, hydration, seed/source-data loaders, and database-local utilities.

## Owns and does not own

- `src/client.ts` creates a Kysely Postgres client and provides `withUserContext` for Supabase RLS claim context.
- `src/types` derives Kysely types from the generated Supabase database contract.
- `src/repositories` exposes authored-shaped repository contracts; domain folders implement hydration and persistence for subjects, features, grants, effects, and character records.
- Does not own API DTOs, HTTP/auth procedure policy, frontend form state, or game-rule orchestration.

## Key flow

An application service validates/compiles an authored record, calls a repository/upsert with a `DBLike`, and receives persisted state. Transactional operations reuse an incoming Kysely transaction or open one at the outermost boundary. Aggregate upserts replace owned relation rows; reads hydrate them back into authored-shaped objects.

The eight authored root domain tables are the canonical active records. `authored_drafts` stores one JSON draft per subject identity: any number of new-item drafts may exist, while an active item may have only one edit draft. Activating a draft replaces the normalized active aggregate in the same transaction and removes the draft. Nested features, options, grants, and effects remain owned by their root and are not independent draft roots. `authored_import_refs` records exact user-scoped external identities for repeat imports without matching by label.

`withUserContext` sets `request.jwt.claim.sub` inside a transaction before RLS-sensitive work. Node-runtime queries use a separate allow-listed query utility rather than accepting arbitrary table/column identifiers.

## Invariants

- Repositories are the persistence seam: callers should not depend on raw Kysely row layouts.
- Kysely owns application writes; Supabase migrations own schema, constraints, RLS, and bootstrap SQL.
- Upsert replacement semantics must remove stale child/link rows before inserting the current authored shape, within one transaction.
- Never start or commit a nested transaction when a `Transaction<Database>` is already supplied as `DBLike`.
- Keep authored hydration distinct from compiled engine data; compilation belongs to shared/functions.

## Focused validation

Use repository tests under `src/__tests__` (especially round-trip, unsupported-upsert, seed, and character tests) and `yarn workspace @artificer-toolkit/db typecheck`. Run `yarn seed:srd:local` to prepare the active local corpus for integration checks. Hosted commands compile the repository-owned `srdBaselineContent` through the normalized persistence path in a rollback-only transaction on the normal local Supabase database, then write the resulting relational rows to the named hosted target in 500-row, foreign-key-ordered batches. The rollback preserves all local development data; there is no second local seed database and persisted local rows are never treated as source data. The hosted transaction forces constraints immediate and verifies row-for-row parity before commit; the separate hosted audit performs the deeper hydrated-domain verification afterward without extending the write transaction. Staging reads only `STAGING_*` variables and production reads only `PROD_*` variables. Reset a hosted public schema only with `yarn db:reset:staging` or `yarn db:reset:production` plus `CONFIRM_REMOTE_PUBLIC_SCHEMA_RESET=reset-public-schema`; there is no targetless reset. The canonical bootstrap restores public profiles and entitlements for surviving Auth users. Create the target's seed owner, keep local Supabase running, run the matching rollback-only dry run, then perform the explicit seed and audit. Use root `yarn audit:srd` for local corpus diagnostics, `yarn test:srd:integration` for rollback-isolated full-corpus persistence, and `yarn test:character-sheet:integration` for Sheet patch persistence. Integration scripts require local Supabase/Postgres and reject remote targets; run seed/reset commands only when the data path is in scope.

## Canonical references

- [Persistence and Kysely](../../docs/architecture/persistence.md)
- [Data lifecycle](../../docs/architecture/data-lifecycle.md)
- [Architecture overview](../../docs/architecture/overview.md)
- [Supabase operations](../../supabase/README.md)
