# Phase 8: Frontend Rewrite and Reattachment

## Objective

Rewrite and reattach the frontend only after the backend, engine, and API contracts are stable. The frontend is frozen during Phases 0–7 and treated as reference-only.

## Prerequisite

Phase 8 cannot begin until Phase 7 is complete and API contracts are stable.

## Rules

- Do not preserve legacy enum-centric assumptions — replace with const-map-driven contracts where domain vocabularies need stable registries
- Do not let legacy frontend structure constrain backend design retroactively
- The new frontend architecture must match the rebuilt backend, not the pre-refactor app

## Workstreams

### 1. Client Architecture Rewrite

- Redesign folder and feature boundaries
- Define new client-side data flow
- Define how the frontend consumes `packages/schema`-backed transport contracts
- Remove stale aliases (`@types`, `@hooks`, `@utils`, `@components/*`, `@enums/*`, `@apis`)

### 2. Input and Form Rendering Rewrite

- Replace legacy form assumptions
- Redesign how inputs are rendered — align with node-map/compiler-backed contracts where appropriate
- Remove legacy enum imports and compatibility layers
- Do not rebuild the old enum-driven form system

### 3. Feature Reattachment

- Reconnect authoring flows (race, class, spell, feat, equipment, background) to the stabilized API
- Reconnect character sheet flows to the Phase 6 engine outputs
- Rework list/detail pages against the new Phase 3/7 DTOs

### 4. Client Cleanup

- Remove legacy type shims that existed only for the pre-refactor frontend
- Remove obsolete enum imports
- Remove aliases that no longer map to real exports
- Remove any server-facing assumptions that were embedded in frontend code

## Deliverables

- New frontend architecture
- Rewritten form/input strategy
- Stable API consumption layer against Phase 7 contracts
- Migration notes from the frozen legacy frontend

## Exit Criteria

- Frontend compiles against finalized backend contracts from Phase 7
- No legacy enum-centric assumptions remain
- Client architecture matches the rebuilt backend
- Web is ready to share transport semantics with a future mobile companion app
