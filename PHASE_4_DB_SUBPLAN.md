# Phase 4: Database Layer - Wrappers, Canonical Source Data, and SRD Seed Pipeline

## Objective

Write typed TypeScript wrappers over the existing SQL upsert procedures, define repository interfaces per domain, establish transaction patterns for multi-entity writes, create a canonical baseline authored-content source layer for SRD content, and implement the seed/import pipeline so the database has real content before Phase 6 begins.

## Key Framing

The SQL upserts already exist for all domains. This phase is still primarily "write TS wrappers," but it also formalizes how baseline content enters and leaves the database.

Source-of-truth split for this phase:

- in-repo canonical baseline content: typed authored/domain-shaped TypeScript files for SRD baseline content
- persisted runtime content: normalized database rows
- repository output: authored-shaped or transport DTO-shaped objects rebuilt from rows
- compiler output: compiled/runtime structures only

The SQL layer is the persistence mechanism, not the canonical authoring representation of baseline content.

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
- `findById(id: string): Promise<AuthoredType | DtoType | null>`
- `findAll(filter?: Filter): Promise<(AuthoredType | DtoType)[]>`

Repositories expose typed function signatures only. Raw Kysely query-builder details should not leak to callers.

Repository hydration rule:

- DB queries return row-shaped data internally
- repository mappers rebuild authored/domain-shaped or DTO-shaped objects from normalized rows
- compilers are not used for DB row hydration

### 5. Transaction Pattern

Establish a reusable transaction pattern for multi-entity writes, for example upserting a race and its associated racial grants atomically.

### 6. Canonical Baseline Source Data

Create a source-data layer for baseline SRD content using authored/domain-shaped TypeScript data.

Requirements:

- baseline SRD content is stored in typed TS files, not raw DB row shape
- content is organized by root domains: subjects, features, grants, effects, and shared helper content where needed
- the source-data shape mirrors the authored content model the app understands
- this source-data layer is used as the import input for database seeding

Suggested location:

- `packages/db/src/source-data/`
- or a dedicated backend-owned source-data folder if Phase 4 reveals a better package-local placement

### 7. SRD Seed Data Strategy

The database is currently empty. The character engine cannot be meaningfully built or tested without reference content.

As part of Phase 4, define and implement the seed/import pipeline:

- TypeScript seed script in `packages/db/src/seed/` that imports canonical authored baseline content and calls the new TS upsert wrappers
- raw SQL fixtures are not the default path; only use them where a specific domain has a concrete need that TS seeding cannot cover cleanly

The SRD baseline content must be loadable into a local dev database before Phase 6 begins.

## Architectural Rules

- Kysely stays server-side only and is never imported by `packages/shared`, `packages/schema`, or any client
- raw SQL files remain persistence assets, not app-facing contracts
- repositories expose typed functions, not raw query-builder details
- domain-to-DB mapping is explicit
- canonical baseline content is authored/domain-shaped TypeScript, not SQL-first fixtures and not compiled output
- repository hydration and compiler transformation stay separate
- `vitest` is the standard test runner for repository wrappers and transaction tests

## Rollout Order

1. shared/common persistence
2. subjects domain
3. grants domain
4. features domain
5. canonical baseline source-data structure
6. SRD seed/import implementation

## Exit Criteria

- typed TS upsert wrappers exist for all SQL upserts across subjects, grants, and features domains
- repository interfaces are defined per domain
- repository reads can rebuild authored/domain-shaped or DTO-shaped data from DB rows without using compilers
- transaction pattern is established and documented by at least one example
- canonical SRD baseline content exists as typed authored/domain source data in the repo
- SRD seed data is loadable into a local dev database through the TS import pipeline
- Phase 5 and Phase 6 can proceed with real data available

## Handoff Note

Use `vitest` for Phase 4 tests. Start with unit tests around wrapper behavior, repository hydration, and seed-pipeline mapping, then add DB-backed integration tests once the test-database strategy is defined.

Current handoff rule for this phase:

- baseline SRD content is represented in authored/domain-shaped TS files
- the database is the persisted source of truth after import
- repository hydration maps rows back into authored/domain or DTO shapes
- compilers are not used for DB row hydration
- if any domain requires a SQL-first fixture exception, document the reason directly in this phase doc when that work lands
