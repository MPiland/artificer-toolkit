# Phase 0: Workspace Architecture and Contract Stabilization

## Status: Complete

Phase 0 work is done. `BACKEND_PACKAGE_CONTRACTS.md` defines the package dependency rules, and `packages/schema` exists and is referenced in the root `tsconfig.json` project references.

This phase is closed. Use it as a guardrail reference, not as an active implementation backlog.

## Handoff Note

If a small backend-only correction is needed later, record it in the active phase subplan and `REBUILD_PLAN.md` instead of reopening Phase 0 as a live checklist.

## Remaining Verification

- Confirm `tsc --build packages/schema` succeeds end-to-end.
- The `ColumnOf` / `TableName` extraction strategy remains a Phase 3 decision.

## What Was Established

### Target Package Roles

- `packages/shared` (future `packages/domain`)
  - authored domain types
  - compiled domain types
  - node-map DSL and node maps
  - compilers
  - resolvers
  - character engine
  - pure domain logic only

- `packages/schema`
  - Zod schemas
  - DTO contracts
  - transport-safe validation boundaries

- `packages/db`
  - Kysely client and types
  - repositories
  - upserts and queries
  - SQL ETL assets
  - DB mappers

- `packages/functions` (future `packages/server`)
  - use-case and orchestration logic
  - authoring services
  - character assembly services
  - future tRPC backing logic

- `apps/apis` (future `apps/api`)
  - thin transport layer only

- `apps/web`
  - frozen during backend rebuild

## Package Dependency Rules

- `shared` must not depend on `functions`, `apis`, or `web`
- `shared` may temporarily depend on `db` where the map DSL requires DB column typing; this is scheduled for removal in Phase 3
- `schema` may depend on `shared`
- `db` may depend on `shared` and `schema`
- `functions` may depend on `shared`, `schema`, and `db`
- `apis` may depend on `functions` and `schema`
- `web` depends on `schema` and client-facing contracts only, but remains frozen during backend work

## Rename and Transition Plan

Physical renames are deferred until after Phase 7 is complete. The trigger is: API routes are stable and consuming services, and no consumers are importing internal package paths.

Planned renames:

- `packages/shared` -> `packages/domain`
- `packages/functions` -> `packages/server`
- `apps/apis` -> `apps/api`

Transitional policy: package names that still use `shared`, `functions`, and `apis` are allowed during the backend rebuild phases.

## Key Structural Issue Catalogued

`nodeDefinition.ts` imports `ColumnOf`, `ColumnValueOf`, and `TableName` from `@artificer-toolkit/db`. This makes the domain DSL depend on Kysely at the package level. That is an allowed temporary exception and is scheduled for resolution in Phase 3.

## What Does Not Reopen Phase 0

- Physical package renames
- Frontend alias or enum cleanup
- Client compatibility work
- Deep export-surface redesign beyond current backend needs
- Trying to make all packages typecheck before the Phase 1 DSL blocker is resolved

## Exit Criteria - Met

- Target workspace responsibilities are documented
- Package dependency rules are documented in `BACKEND_PACKAGE_CONTRACTS.md`
- `packages/schema` exists and is referenced in root `tsconfig.json`
- Dependency violations are catalogued
- Rename sequence is defined
- Phase 1 can proceed without redefining ownership boundaries
