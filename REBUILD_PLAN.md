# Artificer Toolkit Rebuild Plan

## Summary

This project should be treated as a salvage-and-stabilize refactor, not a greenfield rewrite. The codebase already contains substantial domain, persistence, service, API, and frontend logic. The rebuild establishes clean backend package responsibilities and stable interfaces, then repairs the domain kernel, persistence layer, application layer, and API. The frontend is frozen until those backend layers are complete.

## Phase 0 Decision

Phase 0 is complete and closed. The package-boundary guardrails remain active through Phase 7, but Phase 0 should not be reopened as a major implementation phase unless a newly discovered backend-only boundary issue directly blocks Phase 1.

## Current Reality

- The monorepo already has meaningful code in `packages/shared`, `packages/db`, `packages/functions`, `apps/apis`, and `apps/web`.
- The highest-value logic already exists: the node-map DSL, domain model scaffolding, compilers, and SQL schema are largely complete.
- The active blocker has moved to persistence and transport work: `packages/shared` is stable, while `packages/db` still has TypeScript drift and the SQL bootstrap order is not yet safe for empty-database recreation.
- Secondary gaps are: incomplete API DTO coverage, missing TypeScript upsert wrappers, no character engine, and no authored SRD source-data seed pipeline yet.

## Actual Current State

| Component | Status | Notes |
|---|---|---|
| Node maps - new API | Complete | Root authored coverage and nesting are materially in place |
| Node maps - old callback API | Complete | Callback migrations are done |
| Node maps - pre-DSL relics | Complete | Legacy `BRANCH` / `LEAF` / `KNOT` / `PATH` refs are gone |
| Compilers | Present | Drift repaired enough for `packages/shared` to typecheck cleanly |
| Core types | Complete | Domain surface is large and already established |
| DB schema | Complete | SQL assets are present across domains |
| DB upserts (SQL) | Complete | Raw SQL procedures exist |
| DB upserts (TS) | Partial | Only a subset of wrappers exists |
| Query functions | Complete | The functions workspace already has broad coverage |
| `packages/schema` | Complete | Runtime DTO coverage now spans subjects/shared/effects/grants/features/vocabulary/api; correlated modifier/facet payload validation is in place and schema tests pass |
| Character assemblers | Present | Need later reorganization into server/application + engine |
| Rule engine | Missing | Still a future phase |
| API routes | Minimal | Need validation and stabilization later |
| SRD data | Missing | Canonical baseline authored source data and DB seed/import pipeline still need to be created |
| `apps/web` | Frozen | Reference-only until backend is complete |

## Target Workspace Architecture

Package responsibilities stay as-is during the backend rebuild. Physical renames happen after Phase 7.

| Current name | Future name | Role |
|---|---|---|
| `packages/shared` | `packages/domain` | Domain types, node maps, compilers, engine |
| `packages/schema` | `packages/schema` | Zod DTOs and transport contracts |
| `packages/db` | `packages/db` | Kysely client, repositories, upserts, SQL assets |
| `packages/functions` | `packages/server` | Use-case services, character assembly, orchestration |
| `apps/apis` | `apps/api` | Thin transport layer only |
| `apps/web` | `apps/web` | Frozen during backend rebuild |

## Package Dependency Rules

- `shared` must not depend on `functions`, `apis`, or `web`
- `shared` may temporarily depend on `db` where the map DSL requires DB column typing
- `schema` may depend on `shared`
- `db` may depend on `shared` and `schema`
- `functions` may depend on `shared`, `schema`, and `db`
- `apis` may depend on `functions` and `schema`
- `web` depends on `schema` and client-facing contracts only, but remains frozen during backend work

## Phase Sequence

1. Phase 0 - Architecture boundaries (complete, closed)
2. Phase 1 - Root authored node-map coverage (complete)
3. Phase 2 - Compiler hardening (complete)
4. Phase 3 - Schema layer and `shared -> db` decoupling
5. Phase 4 - DB wrappers, canonical source data, and SRD seed pipeline
6. Phase 5 - Server/application layer reorganization
7. Phase 6 - Character engine
8. Phase 7 - API transport stabilization and validation
9. Phase 8 - Frontend rewrite

## Phase Status Tracker

| Phase | Status | Handoff note |
|---|---|---|
| Phase 0 - Architecture boundaries | Complete | Closed. Reopen only for a backend-only blocker that directly blocks Phase 1 |
| Phase 1 - Root authored node-map coverage | Complete | Closed. Remaining `shared` failures are compiler drift, not map-layer coverage |
| Phase 2 - Compiler hardening | Complete | Compiler drift repaired, result-wrapper pattern established, baseline compiler tests added; detailed diagnostics deferred to later authoring-validation work |
| Phase 3 - Schema layer and `shared -> db` decoupling | Complete | `shared` runtime coupling removed; lower-level DTOs and API contracts are in place, correlated payload validation is tightened, and remaining build/bootstrap work belongs to Phase 4 |
| Phase 4 - DB wrappers, canonical source data, and SRD seed pipeline | Pending | Persistence phase and baseline content import; bootstrap audit now shows a real FK cycle, so empty-DB recreate needs a two-pass DDL strategy rather than reorder alone |
| Phase 5 - Server/application layer reorganization | Pending | Future tRPC backing layer |
| Phase 6 - Character engine | Pending | Pure deterministic rules/runtime phase |
| Phase 7 - API transport stabilization and validation | Pending | Backend transport only |
| Phase 8 - Frontend rewrite | Pending | Starts only after backend/API phases are stable |

## Guiding Principles

1. Stabilize seams before rebuilding behavior.
2. Preserve and standardize good existing abstractions.
3. Keep domain logic pure and transport-agnostic.
4. Keep persistence server-side and Kysely-first.
5. Share contracts across future web and mobile through `packages/schema`.
6. Keep API thin and replaceable by future tRPC transport.
7. The engine must be system-agnostic; D&D 5e 2014 SRD is the first implementation, not a hardcoded assumption.
8. Use `vitest` as the standard backend and domain test runner across `shared`, `db`, and `functions`.
9. Canonical baseline SRD content lives in authored/domain-shaped TypeScript source files; the database is the persisted source of truth after import.
10. Repository hydration and compiler transformation are separate layers: DB rows are mapped back into authored/domain or DTO shapes by repositories, and compilers only handle authored to compiled transformations.

## Documentation Standard

Markdown planning docs are the primary project-memory layer.

- Every active phase doc must record status, decisions, blockers, and handoff notes.
- Architecture, migration, and bootstrap decisions must be written into repo docs, not left only in chat history.
- Code comments should be sparse and intentional. Add short intent comments where logic is non-obvious, especially for SRD-baseline vs homebrew-flexibility decisions, cross-package boundaries, and tricky domain rules.
- Do not add boilerplate comments that merely restate the code.
- Use JSDoc selectively for high-value public surfaces:
  - public package exports
  - reusable helpers with non-obvious contracts
  - generic or correlated utilities that are easy to misuse
  - compiler handoff contracts, repository hydration boundaries, and later engine interfaces

Review rule for each phase:

- confirm the handoff note was updated when work landed
- check whether the new abstraction needs a short intent comment or JSDoc to prevent misuse
- prefer clarity without comment noise

## Immediate Next Steps

- [x] Move Zod generation ownership from `packages/shared` into `packages/schema`.
- [x] Create lower-level schema folders for shared, effects, grants, and features.
- [x] Add initial Vitest coverage for `packages/schema`.
- [x] Tighten the first pass of lower-level discriminated schemas for scaling, charges, effects, grants, and starting equipment.
- [x] Tighten the remaining intentionally broad correlated schemas, especially predicate-specific facet payloads and deeply correlated modifier payloads.
- [x] Add the first Phase 3 API request/response DTOs for transport.
- [x] Expand API DTO coverage beyond the initial common/system slice.
- [x] Decide that generated drafts under `packages/schema/src/generated` remain scaffolding unless intentionally reviewed and exported.
- [ ] Begin Phase 4 by repairing the DB bootstrap order so an empty-database recreate can succeed.

## Testing Standard

Backend and domain testing uses `vitest` as the default runner.

Priority order:
- `packages/shared` first: map completeness, compiler behavior, scaling behavior, and later engine tests
- `packages/db` second: repository wrappers and transaction tests
- `packages/functions` second: service orchestration tests
- frontend testing remains deferred until Phase 8

Typecheck is necessary but not sufficient. SRD-baseline behavior and homebrew flexibility should both be covered by tests where scaling, branching, or filtered selections matter.

## Schema Generation Rule

Generated Zod is allowed as a helper, not as the source of truth.

- generation belongs to `packages/schema`, not `packages/shared`
- generated output is draft material for `packages/schema/src/generated`
- hand-authored schemas in `packages/schema/src` remain the canonical exported contracts

## Handoff Rule

Whenever work is completed, update the relevant checklist or status table in this file and the active phase subplan in the same change. This file is the top-level handoff snapshot.
