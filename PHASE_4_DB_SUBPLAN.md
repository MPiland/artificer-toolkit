# Phase 4: Database Layer - Wrappers, Canonical Source Data, and SRD Seed Pipeline

## Objective

Make Kysely the authoritative write layer, define repository interfaces per domain, establish transaction patterns for multi-entity writes, create a canonical baseline authored-content source layer for SRD content, and implement the seed/import pipeline so the database has real content before Phase 6 begins.

## Key Framing

The old SQL upsert-procedure model is no longer the target architecture. `.sql` files should define schema/bootstrap only, while Kysely owns application writes and seed imports.

Phase 4 execution order is now explicitly:

1. finish SQL normalization and schema/bootstrap cleanup
2. recreate the database from tables only
3. regenerate Supabase database types from the live recreated schema
4. standardize the Kysely type surface on that one generated file
5. replace placeholder write modules with true typed Kysely implementations
6. add typed query/repository functions
7. build assemblers that hydrate authored shapes from normalized row/query results

Source-of-truth split for this phase:

- in-repo canonical baseline content: typed authored/domain-shaped TypeScript files for SRD baseline content
- persisted runtime content: normalized database rows
- repository output: authored-shaped or transport DTO-shaped objects rebuilt from rows
- compiler output: compiled/runtime structures only

The SQL layer is the schema/bootstrap mechanism, not the canonical authoring representation of baseline content and not the write API.

## Template Pattern

Four shared-domain TypeScript upsert modules already exist and establish the target pattern to follow:

- `packages/db/src/domains/shared/upserts/charge.ts`
- `packages/db/src/domains/shared/upserts/saving_throw.ts`
- `packages/db/src/domains/shared/upserts/characteristic.ts`
- `packages/db/src/domains/shared/upserts/detail.ts`

New upserts should follow the same structure: typed function accepting a domain object and writing through Kysely transaction/query code. They should not call SQL `upsert_*` procedures.

## Tasks

### 1. Subjects Domain Kysely Upserts

Current module locations in `packages/db/src/domains/subjects/upserts/`:

- `background.sql` to `background.ts`
- `class.sql` to `class.ts`
- `race.sql` to `race.ts`
- `feat.sql` to `feat.ts`
- `spell.sql` to `spell.ts`
- `equipment.sql` to `equipment.ts`

Current progress:

- root subject wrappers now exist for:
  - `background.ts`
  - `character.ts`
  - `class.ts`
  - `equipment.ts`
  - `feat.ts`
  - `race.ts`
  - `spell.ts`
  - `system.ts`
- subject write paths are in migration from SQL-procedure wrappers to Kysely-owned implementations
- `character.ts` is now explicitly blocked on this migration because the legacy SQL function was removed from `character.sql`
- until recreate and DB type regeneration are complete, subject write modules are placeholders rather than trusted implementations

### 2. Grants Domain Kysely Upserts

Replace remaining SQL-procedure-backed grant writes with typed Kysely implementations.

Current progress:

- root grant wrappers now exist for:
  - `feat.ts`
  - `modifier.ts`
  - `proficiency.ts`
  - `sense.ts`
  - `spell.ts`

### 3. Features Domain Kysely Upserts

Replace remaining SQL-procedure-backed feature writes with typed Kysely implementations.

Current progress:

- feature wrappers now exist for:
  - `feature.ts`
  - `option.ts`
- shared helper wrapper coverage now also includes `starting_equipment.ts`
- a root `effect.ts` wrapper now exists so server/seed code has a consistent authored-to-SQL entrypoint for effect containers

### 4. Repository Interfaces

Define a typed repository interface per domain that exposes:

- `upsert(entity: DomainType): Promise<void>`
- `findById(id: string): Promise<AuthoredType | DtoType | null>`
- `findAll(filter?: Filter): Promise<(AuthoredType | DtoType)[]>`

Repositories expose typed function signatures only. Raw Kysely query-builder details should not leak to callers.

Current progress:

- repo-wide repository contracts now exist in `packages/db/src/repositories/contracts.ts`
- the DB package root now exports repository contracts, seed contracts, and source-data contracts from `packages/db/src/index.ts`
- the first concrete repository implementation now exists in `packages/db/src/repositories/system.ts`

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

Current progress:

- the canonical source-data contract now exists in `packages/db/src/source-data/content.ts`
- `BaselineContentBundle` and `defineBaselineContentBundle(...)` are the handoff-safe entrypoint for repo-owned SRD baseline content
- serious SRD content population is now explicitly gated on the normalization audit in `PHASE_4_NORMALIZATION_AUDIT.md`

### 7. SRD Seed Data Strategy

The database is currently empty. The character engine cannot be meaningfully built or tested without reference content.

As part of Phase 4, define and implement the seed/import pipeline:

- TypeScript seed script in `packages/db/src/seed/` that imports canonical authored baseline content and calls the new TS upsert wrappers
- raw SQL fixtures are not the default path; only use them where a specific domain has a concrete need that TS seeding cannot cover cleanly

Current progress:

- seed contracts now exist in `packages/db/src/seed/contracts.ts`
- `seedBaselineContent(...)` now exists in `packages/db/src/seed/baseline.ts`
- the first canonical SRD bundle file now exists at `packages/db/src/source-data/srd/index.ts`
- system/vocabulary seeding is now wired into the seed flow
- real SRD content population is still pending

The SRD baseline content must be loadable into a local dev database before Phase 6 begins.

### 8. Full Normalization Audit

Run a full normalization audit of all persisted authored data before serious SRD population, repository expansion, or long-term query work proceeds.

This is not "normalize everything as far as possible." The standard is:

- normalize until ownership, cardinality, and meaning are clear
- allow finite polymorphic tables when they remain explicit and understandable
- avoid generic catch-all columns
- prefer concrete columns that map to real authored/domain concepts
- allow multiple concrete nullable columns in one table when they represent a real discriminated or correlated payload clearly

This audit includes:

- all persisted authored content tables
- systems/vocabulary persistence
- shared authored helpers
- effects, grants, features, options, and subjects
- character persistence tables

This audit excludes:

- pure engine-derived runtime values unless they are currently being persisted

Character-specific rule:

- `intent` should persist creation, progression, and player choice history
- `state` should persist mutable current play state
- derived engine output should not be persisted by default

Audit artifact:

- `PHASE_4_NORMALIZATION_AUDIT.md`

Normalization gate:

- no serious SRD seed population begins until this audit is complete
- any table group marked `Refactor before seed` must be resolved before broad content entry

## Architectural Rules

- Kysely stays server-side only and is never imported by `packages/shared`, `packages/schema`, or any client
- raw SQL files remain schema/bootstrap assets, not app-facing contracts and not write APIs
- repositories expose typed functions, not raw query-builder details
- domain-to-DB mapping is explicit
- canonical baseline content is authored/domain-shaped TypeScript, not SQL-first fixtures and not compiled output
- repository hydration and compiler transformation stay separate
- `vitest` is the standard test runner for repository wrappers and transaction tests
- SQL `upsert_*` functions should be removed from `.sql` files as each domain is migrated to Kysely writes

## Rollout Order

1. finish all `Refactor before seed` SQL table groups
2. recreate the database from normalized tables/constraints only
3. regenerate DB types and standardize on `src/types/supabase.database.ts`
4. port Kysely writes by domain:
   - systems/vocabulary/shared helpers
   - effects
   - grants
   - features/options
   - subjects
   - character intent/state
5. expand query/repository functions
6. build assemblers over typed query output
7. populate baseline SRD content through the Kysely write layer

## Exit Criteria

- empty-database bootstrap succeeds from normalized SQL only
- the generated DB type source is standardized on one canonical file and Kysely depends on that file only
- typed Kysely write paths exist across subjects, grants, and features domains without depending on SQL `upsert_*` procedures
- repository interfaces are defined per domain
- repository reads can rebuild authored/domain-shaped or DTO-shaped data from DB rows without using compilers
- transaction pattern is established and documented by at least one example
- the full normalization audit is complete for all persisted authored-data tables
- all `Refactor before seed` normalization items are resolved
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
- add selective JSDoc or short intent comments for repository interfaces, hydration boundaries, transaction helpers, and any SRD-generalized seed/import logic that would be easy to misuse later
- if a legacy SQL `upsert_*` function is removed before its Kysely replacement lands, the corresponding TS module must fail explicitly rather than silently targeting a missing database function
- keep the current exported `upsert*` module names as placeholders until regenerated DB types exist, then replace those internals with Kysely writes in place where practical

Current blocker discovered during Supabase recreation:

- the repo's current table SQL is not yet ordered for a true empty-database rebuild
- `shared`/other tables reference later tables such as `classes`, `spells`, `equipment`, `features`, and `options` before those tables exist
- a reference audit now shows this is a real cross-domain cycle, not just a bad include order
- before full recreation or seed work continues, Phase 4 needs a two-pass schema bootstrap plan:
  split cyclic foreign-key creation into a later constraint pass instead of relying on reorder alone
- see `PHASE_4_BOOTSTRAP_AUDIT.md` for the confirmed cycle clusters

Bootstrap progress now in repo:

- `create_database.sql` now uses a more coherent effects-table order (`effects -> conditions/damages -> invocations -> moments`)
- the first deferred constraint pass exists at `packages/db/src/domains/bootstrap/constraints/cross_domain_foreign_keys.sql`
- the first cross-domain FK batch has been moved out of root/shared table creation:
  - `shared/tables/charges.sql`
  - `shared/tables/starting_equipment.sql`
  - `shared/tables/facets.sql`
  - `effects/tables/damages.sql`
- the second FK batch has also moved into the deferred constraint pass:
  - `features/tables/features.sql`
  - `features/tables/options.sql`
  - `grants/tables/feats.sql`
  - `grants/tables/spells.sql`
  - `grants/tables/senses.sql`
  - `grants/tables/modifiers.sql`
  - `grants/tables/proficiencies.sql`
- the remaining subject-side forward references have now also moved into the deferred constraint pass:
  - `subjects/tables/backgrounds.sql`
  - `subjects/tables/feats.sql`
  - `subjects/tables/classes.sql`
  - `subjects/tables/equipment.sql`
  - `subjects/tables/spells.sql`

Type-generation checkpoint:

- `packages/db/package.json` now targets `src/types/supabase.database.ts` for `gen:types`
- Kysely and repository typing should treat that file as the only canonical generated DB type source after recreate
  - `subjects/tables/equipment.sql`
  - `subjects/tables/classes.sql`
  - `subjects/tables/spells.sql`
  - `subjects/tables/races.sql`

Remaining bootstrap work:

- verify the full bootstrap against an actual empty database
- after successful recreate, regenerate the database types before trusting repository/query work against the new schema
- if recreate still fails, record the next failing FK cluster in `PHASE_4_BOOTSTRAP_AUDIT.md` before changing table ownership or delete behavior

Current implementation state outside bootstrap:

- `packages/db` now typechecks cleanly
- repository contracts, canonical baseline content contracts, and seed contracts are in place
- public barrel exports now surface the wrapper layer through `packages/db/src/domains/index.ts`
- root wrappers now cover shared helpers, content subjects, grants, features, and effect containers
- system and character wrapper edge cases are now covered
- DB Vitest coverage now exists for seed orchestration and system-repository hydration
- normalization audit progress is now recorded:
  - shared authored infrastructure reviewed
  - grants reviewed
  - features/options reviewed
  - subject roots reviewed
  - effects reviewed
  - character persistence reviewed
- normalization audit is now complete for all authored-data table groups
- SQL refactor pass is now active
- first `Refactor before seed` table tranche landed:
  - `grants/tables/modifiers.sql`
  - `grants/tables/proficiencies.sql`
- second normalization refactor tranche landed for the feature domain:
  - `features/tables/features.sql`
  - `features/tables/options.sql`
  - `features/upserts/feature.sql`
  - `features/upserts/option.sql`
- subject-root refactor has started:
  - `subjects/tables/classes.sql` now persists class attributes explicitly
  - `subjects/tables/equipment.sql` now persists equipment attributes explicitly
  - `subjects/tables/spells.sql` now persists spell attributes explicitly
  - subject SQL upserts now align better with authored field names in:
    - `subjects/upserts/spell.sql`
    - `subjects/upserts/feat.sql`
    - `subjects/upserts/equipment.sql`
    - `subjects/upserts/class.sql` (partial field-name alignment)
- missing shared SQL helper coverage is starting to close:
  - `shared/upserts/charge.sql` now exists so downstream SQL upserts can stop depending on a TS-only charge path
- cross-domain FK cleanup has been updated for the new modifier payload shape
- `packages/db` still typechecks cleanly and DB Vitest coverage still passes after the first normalization refactor tranche
- current `Refactor before seed` clusters:
  - `shared/tables/charges.sql`
  - `shared/tables/starting_equipment.sql`
  - `grants/tables/modifiers.sql`
  - `grants/tables/proficiencies.sql`
  - `features/tables/features.sql`
  - `features/tables/options.sql`
  - `subjects/tables/classes.sql`
  - `subjects/tables/equipment.sql`
  - `subjects/tables/feats.sql`
  - `subjects/tables/spells.sql`
  - `subjects/upserts/character.sql`
- the next implementation slice is to continue the SQL refactor pass with:
  - the subject-root refactor tranche:
    - `subjects/tables/classes.sql`
    - `subjects/tables/equipment.sql`
    - `subjects/tables/feats.sql`
    - `subjects/tables/spells.sql`
  - then character persistence split cleanup
