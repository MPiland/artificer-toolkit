# Backend Package Contracts

## Summary

This document defines the intended backend package boundaries for the rebuild. It is the working contract for Phase 0 through Phase 7 and should be used to decide where new code belongs.

The frontend is intentionally out of scope until the backend and API phases are complete. Phase 0 is complete; this document remains the operational source of truth for boundary decisions in Phases 1 through 7.

## Package Roles

### `packages/shared` (temporary future `domain`)

- Allowed contents:
  - authored domain types
  - compiled domain types
  - pure domain logic
  - node-map DSL and node maps
  - compilers
  - resolvers
  - character engine
  - domain-local utilities
- Must not depend on:
  - `packages/functions`
  - `apps/apis`
  - `apps/web`
- Temporary exception:
  - may still depend on `packages/db` where the current node-map/query DSL requires DB table typing

### `packages/schema`

- Allowed contents:
  - Zod schemas
  - API DTO contracts
  - transport-safe serialization boundaries
- May depend on:
  - `packages/shared`
- Must not depend on:
  - `packages/functions`
  - `apps/apis`
  - `apps/web`

### `packages/db`

- Allowed contents:
  - Kysely client and types
  - repositories
  - upserts and queries
  - SQL ETL assets
  - DB mappers and DB-local utilities
- May depend on:
  - `packages/shared`
  - `packages/schema`
- Must not depend on:
  - `packages/functions` for generic utilities or orchestration
  - `apps/apis`
  - `apps/web`

### `packages/functions` (temporary future `server`)

- Allowed contents:
  - application services
  - orchestration flows
  - query/use-case composition
  - character assembly services
  - request handling helpers
- May depend on:
  - `packages/shared`
  - `packages/schema`
  - `packages/db`
- Must not depend on:
  - `apps/apis`
  - `apps/web`

### `apps/apis` (temporary future `api`)

- Allowed contents:
  - thin transport layer
  - route handlers
  - request/response mapping
- May depend on:
  - `packages/functions`
  - `packages/schema`
  - `packages/shared` only for temporary contract gaps that should later move into `schema`
- Must not own:
  - domain logic
  - persistence logic
  - orchestration logic beyond transport concerns

## Current Transitional Rules

### Allowed during transition

- temporary compatibility exports
- package names that still use `shared`, `functions`, and `apis`
- temporary `shared -> db` dependency where the map DSL still uses DB table metadata

### Not allowed going forward

- new `shared -> functions` imports
- new `db -> functions` imports
- generic utility reuse across layers when the utility belongs locally
- backend changes made solely to preserve frozen frontend assumptions

## Public Surface Guidance

### `packages/shared`

- Prefer explicit domain barrels
- Avoid adding new root exports unless they are truly package-level contracts
- Keep internal implementation helpers internal when possible

### `packages/db`

- Expose:
  - DB client
  - DB types
  - persistence helpers intended for reuse
- Avoid exposing:
  - raw implementation details from every internal SQL helper by default

### `packages/functions`

- Expose:
  - service entrypoints
  - shared request helpers where transport needs them
- Avoid exposing:
  - internal query fragments unless they are part of an intentional server contract

## Enforcement Priorities

1. Remove cross-layer utility imports.
2. Reduce accidental root-barrel coupling.
3. Move DTO concerns into `packages/schema`.
4. Move server orchestration responsibility fully into `packages/functions`.
5. Rename packages only after boundaries are stable.
