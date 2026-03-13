# Phase 4: Database Layer - TypeScript Wrappers and SRD Seed Data

## Objective

Write typed TypeScript wrappers over the existing SQL upsert procedures, define repository interfaces per domain, establish transaction patterns for multi-entity writes, and produce a seed data strategy so the database has SRD content before Phase 6 begins.

## Key Framing

The SQL upserts already exist for all domains. This phase is "write TS wrappers," not "design the DB layer." The SQL is the source of truth. The TypeScript layer provides typed orchestration over it.

## Template Pattern

Four TS upsert wrappers already exist and establish the pattern to follow:

- `packages/db/src/domains/shared/upserts/charge.ts`
- `packages/db/src/domains/shared/upserts/saving_throw.ts`
- `packages/db/src/domains/shared/upserts/characteristic.ts`
- `packages/db/src/domains/shared/upserts/detail.ts`

New wrappers should follow the same structure: typed function accepting a domain object and calling the existing SQL procedure via the Kysely client.

## Tasks

### 1. Subjects Domain Upsert Wrappers

SQL procedures already in `packages/db/src/domains/subjects/upserts/`:

- `background.sql` to `background.ts`
- `class.sql` to `class.ts`
- `race.sql` to `race.ts`
- `feat.sql` to `feat.ts`
- `spell.sql` to `spell.ts`
- `equipment.sql` to `equipment.ts`

### 2. Grants Domain Upsert Wrappers

Write TS wrappers for existing grants SQL upserts.

### 3. Features Domain Upsert Wrappers

Write TS wrappers for existing features SQL upserts.

### 4. Repository Interfaces

Define a typed repository interface per domain that exposes:

- `upsert(entity: DomainType): Promise<void>`
- `findById(id: string): Promise<CompiledType | null>`
- `findAll(filter?: Filter): Promise<CompiledType[]>`

Repositories expose typed function signatures only. Raw Kysely query-builder details should not leak to callers.

### 5. Transaction Pattern

Establish a reusable transaction pattern for multi-entity writes, for example upserting a race and its associated racial grants atomically.

### 6. SRD Seed Data Strategy

The database is currently empty. The character engine cannot be meaningfully built or tested without reference content.

As part of Phase 4, define and implement a seed data strategy:

- Option A: TypeScript seed script in `packages/db/src/seed/` that imports SRD data as typed objects and calls the new TS upsert wrappers
- Option B: SQL fixture file containing insert statements derived from the SRD

Either approach is acceptable. The SRD data must be loadable into a local dev database before Phase 6 begins.

## Architectural Rules

- Kysely stays server-side only and is never imported by `packages/shared`, `packages/schema`, or any client
- raw SQL files remain persistence assets, not app-facing contracts
- repositories expose typed functions, not raw query-builder details
- domain-to-DB mapping is explicit
- `vitest` is the standard test runner for repository wrappers and transaction tests

## Rollout Order

1. shared/common persistence
2. subjects domain
3. grants domain
4. features domain
5. SRD seed data implementation

## Exit Criteria

- typed TS upsert wrappers exist for all SQL upserts across subjects, grants, and features domains
- repository interfaces are defined per domain
- transaction pattern is established and documented by at least one example
- SRD seed data is loadable into a local dev database
- Phase 5 and Phase 6 can proceed with real data available

## Handoff Note

Use `vitest` for Phase 4 tests. Start with unit tests around wrapper behavior and add DB-backed integration tests once the test-database strategy is defined. Do not block wrapper implementation on full integration coverage, but record any missing DB test setup in the phase checklist when handing off.
