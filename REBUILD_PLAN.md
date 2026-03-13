# Artificer Toolkit Rebuild Plan

## Summary

This project should be treated as a salvage-and-stabilize refactor, not a greenfield rewrite. The codebase already contains substantial domain, persistence, service, API, and frontend logic, but the workspace boundaries and public contracts are unstable. The rebuild should first establish clean backend package responsibilities and stable interfaces, then rebuild the domain kernel, persistence layer, application layer, and API. The frontend is frozen until those backend layers are complete.

## Current Reality

- The monorepo already has meaningful code in `packages/shared`, `packages/db`, `packages/functions`, `apps/apis`, and `apps/web`.
- The highest-value logic already exists in the shared workspace, especially the node-map DSL and domain model scaffolding.
- Most current failures come from stale exports, mismatched authored/core/compiled contracts, broken map implementations, and frontend/server code depending on unstable package surfaces.
- The correct strategy is to stabilize architecture first, then rebuild the broken layers on top of those stable seams.

## Target Workspace Architecture

The monorepo stays intact, but the package responsibilities need to be clarified and partially renamed.

### Target package roles

- `packages/shared` becomes `packages/domain` or is split into `packages/domain` and `packages/schema`
  - Domain-authored types
  - Compiled types
  - Node-map DSL and node definitions
  - Compiler pipeline
  - Resolver contracts and implementations
  - Character engine and pure rules logic

- `packages/schema`
  - Zod schemas
  - API DTO validation
  - Shared transport contracts
  - Serialization-safe boundaries for web, mobile, and API

- `packages/db`
  - Kysely client
  - Repositories
  - Upserts and query functions
  - SQL ETL assets and DB-specific mappers

- `packages/functions` becomes `packages/server` or `packages/application`
  - Use-case orchestration
  - Authoring workflows
  - Compiler and resolver orchestration
  - Character assembly and state services
  - Future tRPC backing logic

- `apps/apis` becomes `apps/api`
  - Thin transport layer only
  - HTTP and/or tRPC surface over `packages/server`

- `apps/web`
  - Frozen legacy frontend during backend rebuild
  - Reference-only until backend/domain/API contracts stabilize
  - Will be heavily refactored after the backend rebuild is complete

- `apps/mobile`
  - Future companion app
  - Uses the same transport/application contracts as web
  - Does not use Kysely directly

## Dependency Order

The implementation order must follow actual architectural dependencies.

1. Workspace boundaries and public package contracts
2. Domain kernel stabilization
3. Node maps
4. Compilers
5. Schemas and transport contracts
6. Kysely repositories and DB layer
7. Server/application services
8. Character engine completion
9. API stabilization
10. Frontend rewrite and reattachment

## Phase 0: Architecture Stabilization

### Objective

Create clean backend workspace boundaries and stable public exports so later phases stop fighting stale package contracts.

### Tasks

1. Define final workspace responsibilities
2. Plan package renames and splits
3. Replace broad barrel surfaces with intentional public APIs
4. Clean up backend tsconfig aliases and package import paths
5. Remove circular package assumptions
6. Define package-level dependency rules

### Deliverables

- Architecture subplan with workspace ownership rules
- Final package naming strategy
- Import/export cleanup strategy
- Alias and contract stabilization checklist

## Phase 1: Node Map Stabilization

### Objective

Stabilize and standardize the node-map system that already exists in the shared workspace.

### Key principle

Do not invent a second map system. Use the current `buildNodeMap().define(...)` DSL as the canonical pattern.

### Tasks

1. Normalize authored payloads used by maps
2. Standardize the map authoring pattern across domains
3. Repair broken map exports and broken imports
4. Add validation rules for map structure and references
5. Define resolver contracts for later phases
6. Bring maps back into alignment with compiler expectations

### Deliverables

- Rewritten node-map subplan
- Canonical map authoring pattern
- Domain-by-domain rollout order
- Validation and success criteria

## Phase 2: Compiler Rebuild

### Objective

Rebuild compilers around clean authored and compiled contracts.

### Tasks

1. Define authored-to-compiled boundaries per domain
2. Separate validation from transformation
3. Add explicit compile result and error types
4. Restore or redefine missing compiler exports
5. Standardize compiler entrypoints and orchestration

### Deliverables

- Compiler subplan
- Compiler contract definitions
- Validation and error model
- Domain rollout order

## Phase 3: Schema and Contract Layer

### Objective

Introduce a clean schema layer for transport-safe validation without overfitting every internal type to Zod.

### Tasks

1. Define what belongs in Zod
2. Define what remains internal TS-only
3. Create DTO schemas for API, web, mobile, and persistence boundaries
4. Separate internal domain generics from transport contracts

### Deliverables

- Schema subplan
- DTO boundary definitions
- Zod adoption rules
- Contract-sharing strategy

## Phase 4: Database Layer

### Objective

Make `packages/db` the Kysely-first persistence layer for reads, writes, and ETL integration.

### Tasks

1. Reconcile domain types with DB representations
2. Establish repository and mapper boundaries
3. Rebuild upserts by domain
4. Build query functions for read models
5. Preserve SQL ETL files as raw persistence assets under typed wrappers

### Deliverables

- DB subplan
- Repository architecture
- Upsert and query rollout order
- ETL integration strategy

## Phase 5: Server/Application Layer

### Objective

Turn the current functions workspace into a real application layer that orchestrates domain logic and persistence.

### Tasks

1. Separate queries from use cases
2. Add authoring services and orchestration flows
3. Add compile-preview and compile-persist flows
4. Add character assembly services
5. Make this layer the future home for tRPC procedures

### Deliverables

- Server/application subplan
- Service boundaries
- Orchestration patterns
- Future tRPC alignment

## Phase 6: Character Engine

### Objective

Complete the character engine as a pure domain subsystem that can drive web and future mobile behavior consistently.

### Tasks

1. Define state and intent models
2. Define deterministic resolution order
3. Apply feature, grant, modifier, and effect resolution
4. Calculate derived values and state transitions
5. Keep persistence outside the engine boundary

### Deliverables

- Engine subplan
- State model
- Resolution pipeline
- Persistence integration points

## Phase 7: API Transport Stabilization

### Objective

Complete the API transport layer over the stabilized backend architecture. Frontend reattachment is intentionally deferred until the backend is complete.

### Tasks

1. Keep API thin over the server/application layer
2. Restore route contracts against schema-backed DTOs
3. Keep the surface compatible with future tRPC clients and a mobile companion app
4. Produce stable backend contracts for the later frontend rewrite

### Deliverables

- API transport subplan
- Route strategy
- Stable backend contract notes for the later frontend rewrite
- Transport compatibility notes for future tRPC/mobile support

## Phase 8: Frontend Rewrite and Reattachment

### Objective

Rewrite and reattach the frontend only after the backend, engine, and API contracts are stable.

### Tasks

1. Redesign folder structure and component organization
2. Replace legacy enum-driven assumptions with const-map-driven contracts
3. Redesign form and input rendering around the new domain/schema contracts
4. Reconnect character and authoring flows to the stabilized API
5. Remove legacy UI assumptions that no longer match the backend

### Deliverables

- Frontend rewrite subplan
- New client architecture
- Stable UI data flow over finalized backend contracts

## Guiding Principles

1. Stabilize seams before rebuilding behavior
2. Preserve and standardize good existing abstractions
3. Keep domain logic pure and transport-agnostic
4. Keep persistence server-side and Kysely-first
5. Share contracts across future web and mobile through schema and service boundaries
6. Keep API thin and replaceable by future tRPC transport

## Success Criteria

### Architectural

- Clear responsibilities for each workspace
- Stable public exports per package
- No circular workspace assumptions
- Backend packages depending on intentional contracts instead of internal implementation details

### Technical

- Package-by-package typecheck recovery
- Stable node-map DSL usage across domains
- Compilers aligned with authored and compiled types
- Kysely-first repositories covering app persistence needs
- Character engine producing deterministic, reusable state

### Product

- Content authoring flows can be rebuilt on stable contracts
- Character sheet state changes can be driven by a real engine
- Future web and mobile can use the same API and application semantics
- The architecture is ready for future tRPC adoption without redoing the persistence layer

## Immediate Next Steps

1. Complete the Phase 0 architecture subplan
2. Replace the current Phase 1 subplan with a node-map stabilization plan
3. Draft the remaining phase subplans in dependency order
4. Keep `apps/web` frozen until backend and API phases are complete
