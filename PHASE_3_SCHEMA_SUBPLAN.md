# Phase 3: Schema Layer and shared→db Decoupling

## Objective

Two tasks are bundled in this phase because they are structurally related: populate `packages/schema` with Zod DTOs for transport boundaries, and remove the runtime dependency that `packages/shared` currently has on `packages/db`.

## Task 1: Decouple shared→db

### The Problem

`packages/shared/src/utils/nodeDefinition.ts` line 2 imports `ColumnOf`, `ColumnValueOf`, `TableName` from `@artificer-toolkit/db`. This makes the pure domain DSL — which should have no server-side dependencies — coupled to Kysely at the package level. This blocks any future use of the DSL outside a server context (browser rendering, workers, tests without a DB).

### The Fix

1. Create `packages/db/src/types/column-meta.ts` — a type-only file that re-exports `ColumnOf`, `ColumnValueOf`, and `TableName` as pure TypeScript types (no runtime Kysely coupling)
2. Update `nodeDefinition.ts` line 2 to `import type { ColumnOf, ColumnValueOf, TableName } from '@artificer-toolkit/db/types/column-meta'` (or equivalent path)
3. Verify there is no remaining runtime import from `packages/shared` to `packages/db`
4. Confirm the build graph is acyclic after the change

## Task 2: Populate packages/schema

### What Belongs in Zod

Zod schemas live at boundaries where runtime validation is necessary:

- authored inputs received over the API (request bodies)
- API response shapes returned to clients
- server-to-client data contracts
- persistence-boundary inputs where external data enters the system

### What Stays TypeScript-Only

Internal types that never cross a process or network boundary stay as plain TypeScript:

- internal compiler utility types
- map DSL types and node entry shapes
- internal engine implementation details
- compiled domain types used only within the server

### Rollout Order

Start with the subjects domain — these are the most-used API surfaces:

1. Race authored input DTO
2. Class authored input DTO
3. Spell authored input DTO
4. Feat authored input DTO
5. Equipment authored input DTO
6. Background authored input DTO

Then grants and features authored inputs as Phase 7 API work requires them.

### Package Structure

`packages/schema/src/` organized by domain mirroring `packages/shared/src/domains/`:

```
packages/schema/src/
  subjects/
    race.ts
    class.ts
    spell.ts
    feat.ts
    equipment.ts
    background.ts
  index.ts   ← re-exports all public DTO schemas
```

## Exit Criteria

- `packages/shared` has no runtime import from `packages/db`
- `packages/schema` exports at least subject-level DTO schemas
- Build graph is confirmed acyclic (`tsc --build` succeeds across all packages)
- Phase 4 and Phase 7 can consume `packages/schema` DTOs without importing `packages/shared` internals
