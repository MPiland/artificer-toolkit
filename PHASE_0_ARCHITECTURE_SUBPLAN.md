# Phase 0: Workspace Architecture and Contract Stabilization

## Objective

Create stable backend workspace boundaries, package responsibilities, and public contracts before deeper domain and feature refactors begin.

This is the real first implementation phase because the current repo failures are amplified by unclear package roles and unstable export surfaces.

## Why This Phase Comes First

Current problems are not isolated to one feature area. They are structural:

- the shared workspace currently carries multiple layers of responsibility
- API code consumes unstable shared exports
- the functions workspace is acting as both query library and application layer
- tsconfig aliases do not reflect a clean architectural model

Later phases will keep breaking if package seams are not stabilized first.

## Target Workspace Strategy

Use a moderate split rather than a minimal cleanup or an aggressive many-package decomposition.

### Target workspaces

- `packages/domain`
  - authored types
  - compiled types
  - node-map DSL and maps
  - compilers
  - resolvers
  - character engine
  - pure domain logic only

- `packages/schema`
  - Zod schemas
  - DTO contracts
  - transport-safe validation

- `packages/db`
  - Kysely client
  - repositories
  - upserts
  - queries
  - SQL ETL assets
  - DB mappers

- `packages/server`
  - use-case and orchestration logic
  - authoring services
  - character assembly services
  - future tRPC backing logic

- `apps/api`
  - thin transport layer

- `apps/web`
  - frozen legacy frontend
  - explicitly out of scope for implementation during backend rebuild

- future `apps/mobile`
  - client of API/contracts, not DB code

## Rename and Transition Plan

### Planned renames

- `packages/shared` -> `packages/domain` or split into `packages/domain` + `packages/schema`
- `packages/functions` -> `packages/server`
- `apps/apis` -> `apps/api`

### Transition policy

- Do not rename everything at once if that would block all implementation work
- First stabilize public surfaces and alias strategy
- Then perform workspace renames or splits in a controlled sequence
- Favor compatibility shims only when they reduce migration risk and are clearly temporary

## Package Dependency Rules

These rules should guide all later implementation.

- `domain` must not depend on `db`, `server`, `api`, or `web`
- `schema` may depend on `domain`
- `db` may depend on `domain` and `schema`
- `server` may depend on `domain`, `schema`, and `db`
- `api` may depend on `server` and `schema`
- `web` may depend on `schema` and client-facing contracts later, but is frozen during backend work

## Public Export Strategy

### Goals

- shrink overly broad barrel exports
- create intentional public surfaces
- stop API and backend code from importing unstable internals

### Required public surfaces

- domain-authored exports
- domain-compiled exports
- map and resolver contracts
- engine contracts
- schema DTO exports
- db repository exports
- server service exports

### Anti-goals

- exporting all internal files through one root barrel
- exposing persistence or server internals to client packages
- forcing future client code to import internal domain implementation details

## Path Alias and Import Cleanup

### Problems to address

- mismatches between package exports and tsconfig paths
- imports that target build output paths or unstable internals

### Required cleanup

- align package imports with actual public package surfaces
- replace stale internal aliases with stable workspace-level imports where appropriate
- remove direct `dist/...` imports from source code
- ensure server and domain imports use package boundaries, not deep internals unless intentionally allowed
- defer all frontend alias cleanup until the frontend rewrite phase

## Implementation Workstreams

### 1. Workspace inventory

- document current responsibilities of each workspace
- identify misplacements of code by concern
- identify circular dependency pressure

### 2. Contract definition

- define what each workspace is allowed to export
- define temporary compatibility exports if needed
- define migration targets for stale import sites

### 3. Alias normalization

- clean tsconfig path aliases
- standardize package import usage
- reduce ambiguous alias naming

### 4. Rename preparation

- prepare package metadata, import maps, and build references for eventual rename/split
- sequence rename operations to minimize churn during implementation phases

## Deliverables

- approved target workspace layout
- package dependency rules
- export-surface strategy
- alias cleanup strategy
- rename/split transition sequence

## Success Criteria

- each workspace has one primary responsibility
- domain logic is isolated from persistence and transport
- backend work can proceed without modifying `apps/web`
- the repo has a documented migration path from current names to target names
- later phases can proceed without redefining package ownership

## Implementation Sequence

1. Audit current public exports and alias usage
2. Define stable package surfaces
3. Define rename and split sequence
4. Update tsconfig/package import strategy
5. Start Phase 1 node-map stabilization against those rules
