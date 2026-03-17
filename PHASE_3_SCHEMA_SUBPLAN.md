# Phase 3: Schema Layer and `shared -> db` Decoupling

## Objective

Populate `packages/schema` with runtime DTO schemas for backend transport boundaries while keeping `packages/shared` pure enough to run without a runtime dependency on the persistence package.

## Status

- `packages/shared` now imports DB column metadata as type-only imports from `@artificer-toolkit/db/types`
- `packages/schema` now exports subject DTO schemas plus reusable nested helper DTO schemas
- lower-level schema folders now exist for shared/effects/grants/features
- vocabulary and system DTO schemas now exist for baseline SRD/source-data work
- API transport helpers now cover route params, systems, and the first content list/single response wrappers for subjects and features
- lower-level reusable schemas are now materially tighter: scaling, charges, range, duration, shape, starting equipment, effects, grants, facets/restrictions, and several subject helpers now use real discriminants instead of broad placeholder strings
- the remaining broad correlated payload hotspots are now tightened: modifier grants validate `valueDomainCode -> domain -> modifierKind -> payload` shape, and recursive facets now validate predicate-specific payload branches instead of accepting arbitrary objects
- the first `packages/schema` Vitest slice is in place and passing with subject, nested-shape, recursive facet, correlated modifier-grant, vocabulary, and transport coverage
- `packages/shared` and `packages/schema` both typecheck cleanly
- Full root build is still blocked by pre-existing `packages/db` TypeScript drift

## Task 1: Decouple `shared -> db`

### The Problem

`packages/shared/src/utils/nodeDefinition.ts` imported DB column metadata from `@artificer-toolkit/db`. That coupled the domain DSL to the persistence package at runtime.

### The Fix

1. Export DB metadata types from `packages/db/src/types`
2. Keep `nodeDefinition.ts` on a type-only import path
3. Verify there is no remaining runtime import from `packages/shared` to `packages/db`
4. Defer full build-graph cleanup until `packages/db` itself is repaired

## Task 2: Populate `packages/schema`

### What Belongs in Zod

Zod schemas live at boundaries where runtime validation is necessary:

- authored inputs received over the API
- API response shapes returned to clients
- server-to-client data contracts
- persistence-boundary inputs where external data enters the system

### What Stays TypeScript-Only

Internal types that never cross a process or network boundary stay as plain TypeScript:

- internal compiler utility types
- map DSL types and node entry shapes
- internal engine implementation details
- compiled domain types used only within the server

### Current Rollout

The first real schema slice now exists for the subjects domain:

- race
- class
- spell
- feat
- equipment
- background

These parent DTOs now reuse named nested helper schemas instead of flattening everything to `unknown`.

Lower-level schema folders now exist for:

- `packages/schema/src/shared`
- `packages/schema/src/effects`
- `packages/schema/src/grants`
- `packages/schema/src/features`

`packages/schema/src/subjects/shared.ts` is now a compatibility barrel plus subject-specific helper schemas, not the primary home for all nested DTOs.

### Generation Decision

Generated drafts are scaffolding only.

- `packages/schema/generateZod.ts` may generate local draft files into `src/generated`
- hand-authored schemas in `packages/schema/src` remain the canonical exported contracts
- generated drafts should not be treated as stable public API unless they are reviewed and re-exported intentionally

### Generation Rule

Schema generation is assistive, not authoritative.

- `packages/schema/generateZod.ts` may be used to generate draft schemas from `packages/shared/src/domains/*/authored`
- generated files belong in `packages/schema/src/generated`
- hand-authored schemas in `packages/schema/src` remain the canonical public contracts
- generated output should be reviewed, refined, or wrapped before export

## Package Structure

`packages/schema/src/` should mirror domain ownership at the package boundary:

```text
packages/schema/src/
  subjects/
    shared.ts
    race.ts
    class.ts
    spell.ts
    feat.ts
    equipment.ts
    background.ts
  index.ts
```

## Exit Criteria

- [x] `packages/shared` has no runtime import from `packages/db`
- [x] `packages/schema` exports subject-level DTO schemas
- [x] Nested helper DTO schemas exist for reusable child shapes
- [x] Initial schema Vitest coverage exists for lower-level parsing plus one nested subject parse
- [x] Correlated payload validation exists for modifier grants and recursive facet predicates
- [x] The first API DTO layer exists beyond the common/system slice
- [ ] Full root build is confirmed acyclic (`tsc --build` succeeds across all packages) - still blocked by `packages/db` drift and Phase 4 bootstrap work
- [x] Phase 4 and Phase 7 can consume `packages/schema` DTOs without importing `packages/shared` internals

## Handoff Note

Phase 3 is complete. `packages/shared` is decoupled from DB runtime imports, `packages/schema` now owns the runtime contract layer, lower-level DTOs are materially tightened, recursive facet payloads and modifier-grant payloads are correlated, and schema tests plus package-local typechecks are green. The remaining repo-wide blocker is `packages/db` drift and SQL bootstrap ordering, which belongs to Phase 4 rather than Phase 3. The SQL layer still needs broader RLS review as part of the DB recreation work: root system policies now exist, but many child tables are still protected by deny-by-default rather than complete client-facing policies. That is safe for server-driven access, but not yet a full direct-client RLS story for nested content editing.

Documentation rule for this phase:

- keep schema/public DTO exports understandable with selective JSDoc where a reusable contract is not obvious from the type alone
- add short intent comments only where the schema intentionally generalizes SRD behavior for homebrew flexibility or preserves a non-obvious transport boundary
- do not add repetitive comments that restate field names or discriminants

Remote-state note:

- the Supabase project now has the root `systems`/vocabulary/user-management slice applied
- security advisors are clean except for the Auth-level leaked-password-protection setting
- a full empty-database rebuild is currently blocked by SQL dependency ordering in the repo, because later-domain tables are referenced before they exist
