# Phase 0 Architecture Audit

## Status: Complete

This document captures the architectural state of the repo at the start of Phase 0 and the decisions made. All Phase 0 work is done.

Phase 0 is now a closed reference record. Keep it for context and constraints, but do not treat it as an active phase unless a new backend-only blocker forces a targeted correction.

## Current Workspace Inventory

### `packages/shared`

- Current role: domain-authored types, core types, compiled output types, node-map DSL and maps, compiler implementations, utility helpers
- Key issue: temporary dependency on `packages/db` for DB column type metadata used in the map DSL. This is an allowed temporary exception and is scheduled for Phase 3 resolution.

### `packages/db`

- Current role: Kysely client and types, SQL ETL assets, TypeScript upsert helpers
- Key issue: TypeScript upsert wrappers are incomplete; SQL procedures exist more broadly than the TS wrapper layer

### `packages/functions`

- Current role: query modules, character assemblers, request handling utilities
- Key issue: query logic and application orchestration are mixed. Phase 5 separates them internally.

### `packages/schema`

- Current role: placeholder scaffold
- State: exists with valid package metadata and root project references; `src/index.ts` intentionally remains minimal until Phase 3

### `apps/apis`

- Current role: thin route wrappers over query functions
- Key issue: no input validation and limited error-handling strategy. Phase 7 addresses this.

### `apps/web`

- Current role: main frontend
- Current handling: no implementation work during backend phases; preserve as migration reference only

## Dependency Violations Identified

### Structural

- `packages/shared` depends on `@artificer-toolkit/db` in the map DSL; this remains the only allowed temporary exception
- no `shared -> functions` dependencies remain, and none should be introduced
- no `db -> functions` dependencies remain, and none should be introduced

### Node Map DSL Migration in Progress

The `codex/refactor` branch is mid-migration from an old node-map API to the current `buildNodeMap().define(mapId, api)` API. Several maps still use one of three pre-migration forms:

1. old callback signature
2. pre-DSL relic kinds such as `BRANCH`, `LEAF`, `KNOT`, and `PATH`
3. ad hoc object literals not using the DSL at all

This remains the Phase 1 blocker.

## Decisions Made

- Keep the monorepo intact.
- Use a moderate workspace split, not aggressive decomposition.
- Keep `packages/schema` as the Phase 3 schema target.
- Delay physical package renames until after Phase 7.
- Use Kysely only in server-side workspaces.
- Plan for future tRPC over the server/application layer, not over direct DB access from clients.
- The character engine must be system-agnostic; D&D 5e 2014 SRD is the first implementation.
- `apps/web` remains frozen for the duration of the backend rebuild.

## Phase 0 Exit Criteria - Met

- `packages/schema` exists and is referenced in root `tsconfig.json`
- target workspace responsibilities are documented
- dependency violations are identified
- package rename sequence is defined
- Phase 1 can proceed without redefining ownership boundaries
- no new backend work requires modifying `apps/web`
