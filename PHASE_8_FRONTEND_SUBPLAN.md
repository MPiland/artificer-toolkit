# Phase 8: Frontend Rewrite and Reattachment

## Objective

Rewrite the frontend after backend and API work is complete, using the stabilized domain, schema, server, and API contracts as the source of truth.

## Rules

- do not preserve legacy enum-centric assumptions
- use const-map-driven contracts where domain vocabularies need stable registries
- redesign folder structure, component boundaries, and input rendering around the new backend contracts
- do not let legacy frontend structure constrain backend design retroactively

## Workstreams

### 1. Client architecture rewrite

- redesign folder and feature boundaries
- define new client-side data flow
- define how the frontend consumes schema-backed transport contracts

### 2. Input and form rendering rewrite

- replace legacy form assumptions
- redesign how inputs are rendered from backend/domain metadata
- align UI flows with the new node-map/compiler/engine-backed contracts where appropriate

### 3. Feature reattachment

- reconnect authoring flows to the stabilized API
- reconnect character sheet flows to the finalized character engine outputs
- rework any list/detail pages against the new DTOs

### 4. Client cleanup

- remove stale aliases
- remove obsolete enum imports and compatibility layers
- remove legacy type shims that existed only for the old frontend

## Deliverables

- new frontend architecture
- rewritten form/input strategy
- stable API consumption layer
- migration notes from the frozen legacy frontend

## Success Criteria

- the frontend compiles against finalized backend contracts
- no legacy enum-centric assumptions remain
- the client architecture matches the rebuilt backend instead of the pre-refactor app
- web is ready to share transport semantics with a future mobile companion app
