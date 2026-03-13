# Phase 0 Architecture Audit

## Summary

This document captures the current architectural state of the repo at the start of Phase 0 and turns the approved rebuild plan into concrete transition work. The main conclusion is that the codebase already contains most of the needed layers, but those layers are not cleanly separated. The frontend is now frozen and should be treated as reference-only until backend and API work is complete.

## Current Workspace Inventory

### `packages/shared`

- Current role in practice:
  - domain-authored types
  - domain core types
  - compiled output types
  - node-map DSL and map definitions
  - compiler implementations
  - utility helpers
  - traces of schema generation
- Main issues:
  - overloaded public surface
  - dependency pressure from persistence and service layers
  - stale exports causing downstream breakage
  - mixed authored/core/compiled/schema concerns in one package

### `packages/db`

- Current role in practice:
  - Kysely client and types
  - SQL ETL assets
  - partial TS upsert helpers
- Main issues:
  - TS helpers are out of sync with current domain contracts
  - missing helper exports expected by downstream packages
  - no clear repository boundary yet

### `packages/functions`

- Current role in practice:
  - query modules
  - Supabase client helpers
  - runtime assemblers for character data
  - request handling utilities
- Main issues:
  - package name does not reflect actual responsibility
  - query logic and application orchestration are mixed together
  - acts as a server/application layer without being structured like one

### `apps/apis`

- Current role in practice:
  - thin route wrappers over functions/query logic
- Main issues:
  - package name should be singular to match role
  - route contracts depend on unstable shared exports

### `apps/web`

- Current role in practice:
  - main frontend
  - route loaders and UI flows
  - authoring forms
  - character flows
  - local aliases and some server-facing integration code
- Main issues:
  - broad alias surface with drift
  - depends on missing or stale package exports
  - mixes frontend concerns with some server-facing assumptions
- Current handling decision:
  - no implementation work during backend phases
  - preserve only as migration reference

## Current Dependency Problems

### Structural

- `packages/shared` currently depends on `@artificer-toolkit/db`
- `packages/shared` currently depends on `@artificer-toolkit/functions`
- this means the intended domain layer is not pure

### Export surface drift

- `apps/apis` imports many domain types directly from `@artificer-toolkit/shared`
- `packages/functions` imports many `@artificer-toolkit/shared/types` contracts that no longer line up with live exports
- `apps/web` relies on package exports and aliases that no longer map cleanly to current files

### Alias drift

- `apps/web` has many local aliases such as `@types`, `@hooks`, `@utils`, `@components/*`, and `@enums/*`
- some aliases point at folders that no longer provide the exports callers expect
- `@apis` is used widely in `apps/web`, but the current TypeScript path config does not define it
- this drift is intentionally deferred until the frontend rewrite

## Target Transition State

### New or clarified workspaces

- `packages/schema`
  - Zod schemas
  - DTO contracts
  - transport-safe validation

- `packages/shared`
  - temporary home of the future domain package
  - should move toward pure domain responsibility

- `packages/functions`
  - temporary home of the future server/application package
  - should move toward use-case orchestration responsibility

### Later renames

- `packages/shared` -> `packages/domain`
- `packages/functions` -> `packages/server`
- `apps/apis` -> `apps/api`

## Immediate Phase 0 Work

### 1. Introduce schema workspace

- create `packages/schema`
- wire it into root workspaces and TS references
- keep it minimal until contract migration starts

### 2. Stabilize package contracts

- document intended exports for each package
- reduce accidental root-barrel usage where practical
- stop introducing new imports against unstable internals

### 3. Backend-only alias strategy

- audit backend and API alias usage
- define which imports should become workspace package imports
- defer `apps/web` alias cleanup until the frontend rewrite phase

### 4. Prepare domain purification

- identify imports that make `packages/shared` depend on persistence or server layers
- move those responsibilities out over later phases
- keep new code from increasing those cross-layer dependencies

## Initial Decisions

- keep the monorepo
- use a moderate workspace split
- add `packages/schema` now
- delay physical package renames until public surfaces are stabilized
- use Kysely only in server-side workspaces
- plan for future tRPC over the server/application layer, not over direct DB access from clients

## Exit Criteria For Phase 0

- `packages/schema` exists and is wired into the repo
- target workspace responsibilities are documented
- current dependency violations are identified
- alias cleanup targets are identified
- package rename sequence is defined
- implementation of Phase 1 can proceed without redefining ownership boundaries
- no new backend work requires modifying `apps/web`
