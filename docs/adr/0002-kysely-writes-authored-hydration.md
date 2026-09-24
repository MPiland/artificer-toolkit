# ADR 0002: Kysely-owned writes and authored-shaped hydration

- **Status:** historical — superseded by [ADR 0029](0029-convex-backend-cutover.md)
- **Date:** 2026-07-10
- **Scope:** database writes, repositories, upserts, and read-model boundaries
- **Update when:** write ownership, transaction/RLS behavior, upsert replacement semantics, or repository return shapes change
- **Verification:** `packages/db/src/client.ts`; `packages/db/src/repositories/contracts.ts`; `packages/db/src/domains/**/repositories`; `packages/db/src/domains/**/upserts`; round-trip repository tests
- **Amended:** [ADR 0022](0022-versioned-domain-documents-and-correctness-projections.md) replaced active normalized hydration as the operational read model during the SQL era. [ADR 0029](0029-convex-backend-cutover.md) supersedes SQL/Kysely persistence ownership.

> This ADR records the retired SQL/Kysely implementation. It is not current persistence guidance.

## Context

Authored objects are convenient domain shapes, while the database is normalized across roots, child rows, grants, facets, and join tables. Exposing row layouts to application services or the web couples every caller to persistence details and makes aggregate replacement unsafe.

## Decision

Application writes are owned by `packages/db` and implemented with Kysely. SQL remains the source for schema/bootstrap/migrations; SQL procedures are not the product write API. Repositories and domain upsert modules translate authored aggregates to rows and execute the required transaction boundary.

The public repository contract is authored-shaped:

```ts
interface AuthoredRepository<TAuthored, TFilter = RepositoryFindAllOptions> {
  upsert(entity: TAuthored): Promise<void>
  findById(id: string, filter?: TFilter): Promise<TAuthored | null>
  findByIds(ids: readonly string[], filter?: TFilter): Promise<Map<string, TAuthored>>
  findAll(filter?: TFilter): Promise<TAuthored[]>
}
```

An upsert replaces the owned aggregate represented by the supplied authored object, including its owned nested rows, within one transaction. It must not silently leave stale child rows behind. The implementation must preserve ownership, system/master visibility, and user/RLS context. `withUserContext` establishes the Supabase request claim inside the transaction before repository work runs.

Reads hydrate the authored shape (and, where explicitly named, a resolved shape such as `ResolvedRace` or `ResolvedEquipment`). Callers do not receive raw Kysely builders or normalized row layouts.

## Consequences

Functions/services and API procedures depend on repository contracts, not SQL table topology. Repository round-trip tests are the primary guard that an authored object can be written and hydrated without shape drift. Any new aggregate needs a typed repository/upsert path and tests for replacement, ownership, master records, and nested data.
