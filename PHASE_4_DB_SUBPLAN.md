# Phase 4: Database Layer - Wrappers, Canonical Source Data, and SRD Seed Pipeline

## Objective

Make Kysely the authoritative write layer, define repository interfaces per domain, establish transaction patterns for multi-entity writes, create a canonical baseline authored-content source layer for SRD content, and implement the seed/import pipeline so the database has real content before Phase 6 begins.

## Key Framing

The old SQL upsert-procedure model is no longer the target architecture. `.sql` files should define schema/bootstrap only, while Kysely owns application writes and seed imports.

Phase 4 execution order is now explicitly:

1. complete the authored-contract audit and lock any contract reshapes first
2. finish SQL normalization and schema/bootstrap cleanup against those settled authored contracts
3. recreate the database from tables only
4. regenerate Supabase database types from the live recreated schema
5. standardize the Kysely type surface on that one generated file
6. replace placeholder write modules with true typed Kysely implementations
7. add typed query/repository functions
8. build assemblers that hydrate authored shapes from normalized row/query results

Source-of-truth split for this phase:

- in-repo canonical baseline content: typed authored/domain-shaped TypeScript files for SRD baseline content
- persisted runtime content: normalized database rows
- repository output: authored-shaped or transport DTO-shaped objects rebuilt from rows
- compiler output: compiled/runtime structures only

The SQL layer is the schema/bootstrap mechanism, not the canonical authoring representation of baseline content and not the write API.

Recent Phase 4 progress against the settled authored contracts:

- `saving_throws.sql` now matches the `SOURCE_SAVE_DC` vs fixed-value authored split more honestly
- class resources and feature roots now persist `available_at_level` to match the settled `availableAtLevel` contract
- feat, sense, and spell grant root/scaling tables now enforce tighter authored discriminator invariants before recreate:
  - root `selection_kind` and `scaling_kind` are now constrained to the authored enum values
  - root `authoring_mode_kind` is now constrained to real root usage, with `PER_LEVEL` rows forced onto the neutral `ALL` sentinel instead of carrying stale root-selected state
  - per-level rows now require positive `level` / `sort_order` values and unique `(grant_id, level)` pairs so grant progression cannot persist duplicate authored levels
  - spell grants now also validate positive `cast_at_level` values and restrict persisted attribute codes to the settled authored spell-grant attribute set
- the create-database bundle has been regenerated from the current normalized SQL
- the linked Supabase project has now been destructively reset, recreated from the generated bootstrap bundle, and accepted the two-pass DDL strategy end to end
- `packages/db/src/types/supabase.database.ts` has now been regenerated from that recreated linked schema
- stale feature, option, and grant trait persistence has been removed from both table SQL and legacy SQL upsert sources
- stale subject-root trait persistence has been removed from the remaining subject SQL upsert sources (`spell`, `equipment`, and `feat`)
- feature per-level option persistence now matches settled `optionChoices` authoring instead of the older `optionsPerLevel + optionIds` model
- class spellcasting prepare-limit persistence now includes real per-level authored values instead of dropping `prepareLimit.perLevel`
- class spellcasting attributes now persist through a real owned `class_spellcasting_attributes` table instead of a stale nonexistent `class_spellcasting_traits` surface
- class multiclass persistence now follows authored `requirementGroups -> requirements` instead of the older recursive requirement tree
- charge-limit persistence now matches the newer authored scaling refs more closely:
  - `charge_limits` supports `CLASS_LEVEL`, `PARENT_CLASS_LEVEL`, and `SPELL_CAST_LEVEL`
  - local DB write helpers no longer write legacy `SOURCE_LEVEL` back into storage
- damage/feat/spell/sense scaling persistence no longer carries stale scaling `spell_id` columns
  - scaling refs now match the settled authored meaning of `SPELL_CAST_LEVEL` instead of tying scaling to a base spell identity
- character class-spell state no longer persists redundant `class_level`, and character resource usage now points at persisted `character_resource_grants` instead of class resource definitions
- character race identity no longer overlaps ancestry persistence; `character_race` now stores only race and subrace while ancestry options live in `character_ancestry_acquisitions`
- character subclass provenance now consistently references subclass class rows, while subtype references remain separate wherever `subtypeId` is modeled
- character starting-equipment session tables now use authored `applied` wording instead of the older `added_to_character` field name
- option-derived character provenance now persists `acquired_parent_id`, so feature acquisitions, spell selections, and resource grants keep the parent acquisition chain the authored model expects
- character feature-selection value rows now enforce payload-column correlation by `value_kind`, reducing impossible persisted selection states
- character ability-generation persistence is now more authored-aligned:
  - `character_abilities` stores explicit `method_code` instead of a generic `selected_system` reference
  - manual-rolled assignments now live in `character_abilities_manual_assignments`, which matches the authored `assignments` concept instead of the misleading `manual_overrides` name
- large upsert modules were split into orchestration-plus-helper structure to improve maintainability without changing behavior:
  - effect upserts now separate orchestration (`effect.ts`), row mapping/validation (`effect.mappers.ts`), and delete/nested persistence helpers (`effect.persistence.ts`)
  - character upserts now separate orchestration (`character.ts`) from mapping/dependency/delete helpers (`character.helpers.ts`)
- the earlier recreate/type-regeneration auth blocker is resolved for this session:
  - the linked project now reflects the normalized schema bundle
  - the checked-in generated DB types have been refreshed from that live recreated schema

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
- legacy SQL grant upsert sources no longer try to write removed `*_grant_traits` tables
- legacy SQL grant procedures for `feat`, `proficiency`, `sense`, and `spell` have now been removed entirely; their TS write exports are explicit placeholders until typed Kysely writes land after recreate/type regeneration
- `modifier.ts` now follows the same explicit-placeholder rule, matching the earlier removal of the stale SQL modifier procedure
- the remaining subject root and system TS write exports (`background`, `class`, `equipment`, `feat`, `race`, `spell`, and `system`) now follow that same explicit-placeholder rule after removal of their legacy SQL procedures

### 3. Features Domain Kysely Upserts

Replace remaining SQL-procedure-backed feature writes with typed Kysely implementations.

Current progress:

- feature wrappers now exist for:
  - `feature.ts`
  - `option.ts`
- shared helper wrapper coverage now also includes `starting_equipment.ts`
- a root `effect.ts` wrapper now exists so server/seed code has a consistent authored-to-SQL entrypoint for effect containers
- legacy feature and option SQL upsert sources no longer try to write removed `feature_traits` or `option_traits` tables
- legacy SQL feature and option procedures have now been removed entirely; their TS write exports are explicit placeholders until typed Kysely writes land after recreate/type regeneration
- legacy SQL effect procedures and nested effect-payload procedures have now been removed entirely; `effect.ts` is now an explicit placeholder until typed Kysely writes land after recreate/type regeneration
- the legacy SQL starting-equipment procedure tree has now been removed entirely; `starting_equipment.ts` is now an explicit placeholder until typed Kysely writes land after recreate/type regeneration
- the legacy SQL charge helper procedure and the last SQL-only write helper (`upsert_json_array`) have now also been removed so the repo no longer keeps an intended SQL write API
- a repo-wide search under `packages/db/src` now finds no remaining `public.upsert_*` definitions or calls; Phase 4 has crossed the "no intended SQL write API remains in source" checkpoint before recreate
- the latest table-definition audit against the settled authored contracts has now tightened several remaining persistence mismatches before recreate:
  - starting-equipment items keep explicit `authoring_mode_kind`; `ALL` means no ids and `SELECTED` requires ids
  - feat/spell/sense/proficiency grant tables now allow omitted `authoring_mode_kind` and enforce cleaner selection/scaling discriminator checks
  - optional feat/spell/sense grant charges are now nullable in persistence
  - class spellcasting charges are now required when a spellcasting subtree exists
  - facet selection tables now allow omitted `authoring_mode_kind` to match the authored selectable default
  - race root persistence now enforces base-vs-subrace invariants and no longer carries the stale `race_traits` table
  - required equipment vocabulary references (`rarity_id`, `cost_currency_id`) now use `ON DELETE RESTRICT` instead of the contradictory `SET NULL`
  - one malformed equipment table comment block and one stale `SPELL_SLOT_LEVEL` comment were corrected so recreate SQL matches the settled authored terminology
  - effect moment persistence now keeps authored moment ids and roll-table entry `description` instead of the older “no moment id / required label” assumptions

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
- serious persistence-shape work is now also gated on `PHASE_4_AUTHORED_CONTRACT_AUDIT.md`

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

### 9. Full Authored Contract Audit

Run a full authored-contract audit before further persistence-shape work continues.

This audit is broader than scaling. It covers:

- shared helper authored contracts
- effects and grants
- feature and subject roots
- character authored contracts

This audit exists to answer whether the current authored contracts are the right content-creation shapes for:

- SRD-first mechanics
- homebrew flexibility
- authoring UI ergonomics
- long-lived persisted content

Audit artifact:

- `PHASE_4_AUTHORED_CONTRACT_AUDIT.md`

Authored-contract gate:

- further Phase 4 table-shape changes should pause until this audit is decision-complete
- shared abstractions should survive only if they are truly cross-domain and not merely generic
- persistence normalization should resume only after authored contracts are locked

## Architectural Rules

- Kysely stays server-side only and is never imported by `packages/shared`, `packages/schema`, or any client
- raw SQL files remain schema/bootstrap assets, not app-facing contracts and not write APIs
- repositories expose typed functions, not raw query-builder details
- domain-to-DB mapping is explicit
- canonical baseline content is authored/domain-shaped TypeScript, not SQL-first fixtures and not compiled output
- repository hydration and compiler transformation stay separate
- `vitest` is the standard test runner for repository wrappers and transaction tests
- SQL `upsert_*` functions should be removed from `.sql` files as each domain is migrated to Kysely writes
- authored contracts are the source of truth for persistence-shape decisions; if those contracts are under audit, Phase 4 persistence-shape work pauses at the decision level until that audit closes

## Rollout Order

1. complete `PHASE_4_AUTHORED_CONTRACT_AUDIT.md`
2. update authored contracts, maps, compilers, and schema where the audit requires reshapes
3. finish all `Refactor before seed` SQL table groups
4. recreate the database from normalized tables/constraints only
5. regenerate DB types and standardize on `src/types/supabase.database.ts`
6. port Kysely writes by domain:
   - systems/vocabulary/shared helpers
   - effects
   - grants
   - features/options
   - subjects
   - character intent/state
7. expand query/repository functions
8. build assemblers over typed query output
9. populate baseline SRD content through the Kysely write layer

## Exit Criteria

- empty-database bootstrap succeeds from normalized SQL only
- the authored-contract audit is complete and any required contract reshapes are implemented before persistence normalization resumes
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
- the shared-helper normalization tranche is moving forward:
  - `charges.sql` now has authored-aligned limit checks, stable child IDs, and allows multiple bonuses of the same kind
  - `starting_equipment.sql` now enforces the equipment-vs-currency payload split and chosen-vs-granted invariants at the table level
- the subject-root normalization tranche is also moving:
  - `classes.sql` now removes the stale root `class_traits` surface and keeps the valid root category invariant on the class row itself
  - `equipment.sql` now removes `equipment_traits`, makes capacity truly optional, and enforces the variant-vs-base parent rule
  - `feats.sql` now removes stale root `restriction_id` and `feat_traits` storage
  - `spells.sql` now removes stale root `concentration_type` and `spell_traits` storage
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

- ✅ verified the full bootstrap: live DB table set matches the bundle exactly (178 public tables, zero delta)
- ✅ DB types regenerated: `src/types/supabase.database.ts` shrunk from 394 KB to 206 KB; all stale table references (`class_spellcasting_traits`, scaling `spell_id` FKs, `race_traits`, `feat_traits`, `equipment_traits`, `equipment_speed`) are gone
- ✅ `packages/db` typechecks cleanly and all 19 files / 159 tests pass against the regenerated types
- bootstrap checkpoint is now complete; next step is porting Kysely writes by domain (rollout step 6)

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
- authored-contract audit is now a hard gate before more Phase 4 table-shape decisions land
- `PHASE_4_AUTHORED_CONTRACT_AUDIT.md` now exists as the decision artifact for:
  - shared helper authored contracts
  - effects and grants
  - feature and subject roots
  - character authored contracts
- the current design bias recorded there is:
  - keep shared level-source concepts only where they are truly cross-domain
  - prefer domain-local mechanic-shape unions over generic helper abstractions when semantics differ materially
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
  - the legacy subject-root SQL procedures have now been removed and their TS write exports are explicit placeholders until post-recreate Kysely writes land
- shared helper write migration has crossed the same boundary:
  - `shared/upserts/charge.ts` is the live Kysely implementation example
  - the legacy SQL `upsert_charge(...)` helper is removed
  - the legacy SQL `upsert_json_array(...)` helper is removed
- `shared/upserts/charge.ts` remains a live Kysely implementation and is the current model for how the remaining placeholder write modules should look after recreate and regenerated DB types
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
  - `subjects/tables/characters.sql`
- bootstrap boundary cleanup is also moving:
  - `utils/tables/utils.sql` no longer recreates `public.upsert_json_array(...)`
  - the next bundle regeneration should therefore stop pulling a SQL write helper into the schema/bootstrap path
- the next implementation slice is no longer more SQL reshaping by default
- `PHASE_4_AUTHORED_CONTRACT_AUDIT.md` is now populated with contract-by-contract verdicts and the decision gate is closed at the authored-model level
- the next required slice is to apply those authored reshapes through `packages/shared` and `packages/schema`, then resume persistence-shape work against the settled contracts
- character persistence split cleanup is now materially underway:
  - `subjects/tables/characters.sql` removed `character_spell_slots` because spell-slot usage is not part of the current `CharacterState` contract
  - advancement, hitpoint, hit-dice, resource-usage, and spell/resource selection tables now have tighter authored-aligned invariants
  - hitpoint intent and ability-generation persistence have started aligning to the current authored contracts:
    - stale `ROLLED` hitpoint method support is removed
    - point-buy and standard-array tables now persist `ability + option` choices instead of derived leftovers
  - starting-equipment character decisions now reference the selected authored option items directly instead of ambiguous selection IDs
  - manual-rolled ability persistence now stores assignment and progress at the roll-group level instead of incorrectly spreading them across individual roll rows
  - ability-generation intent now persists an explicit generation method code and a properly named manual-assignment table instead of older generic/system-option terminology
  - remaining character work is recreate validation against the normalized character schema, then DB type regeneration
- authored-contract audit outcomes now locked for the next implementation pass:
  - remove vague `SOURCE_LEVEL`
  - use explicit scaling references (`CHARACTER_LEVEL`, `CLASS_LEVEL { classId }`, `SPELL_CAST_LEVEL`, and parent-scoped class progression)
  - keep scaling responsible for magnitude only while restrictions and filters own applicability
  - split overly generic shared scaling helpers into smaller shared source concepts plus domain-local mechanic payloads
  - keep `intent` as persisted character choice history and keep `state` focused on mutable sheet state only
- first authored-contract implementation slice is now landed and verified:
  - shared scaling now uses `SPELL_CAST_LEVEL` and `PARENT_CLASS_LEVEL`
  - shared authored charge limits no longer use `SOURCE_LEVEL`
  - grant/effect maps and compiler tests are aligned to the explicit scaling-reference model
  - `PoolScaledValue` has been removed from the shared authored helper layer and localized into damage
  - both `packages/shared` and `packages/schema` typecheck cleanly after the refactor
- second authored-contract implementation slice is now landed and verified:
  - feature scheduling now uses `availableAtLevel` instead of stringly `levelAvailable`
  - feature option progression now uses `optionChoices` instead of storage-oriented `optionsPerLevel`
  - feature compiler output and feature DTO schemas are aligned to the more authoring- and sheet-prompt-friendly names
- latest authored-contract implementation slice is now landed and verified:
  - facet and selectable authoring keep explicit `authoringModeKind`; `ALL` carries no ids and `SELECTED` requires ids
  - the shared facet map no longer forces `authoringModeKind: ALL` in the common case
  - the schema test suite now covers omitted facet authoring mode as a valid defaulting path
- latest shared-helper refinement is now landed and verified:
  - saving throws now use `SOURCE_SAVE_DC` instead of the spell-only `SPELL_SAVE_DC` branch name
  - the shared option labels and DTOs now match the actual authoring meaning: use the owning spell or feature save DC, or use a fixed DC
  - `packages/shared` and `packages/schema` still typecheck, and both current Vitest slices still pass after the rename
- latest character-intent refinement is now landed and verified:
  - character starting-equipment decisions now reference authored `groupId` and `optionId` instead of brittle array indexes
  - this keeps player choices stable if authored starting-equipment trees are reordered later
  - `packages/shared` still typechecks after the character intent reshape
- latest grant-authoring refinement is now landed and verified:
  - grant payloads keep explicit `authoringModeKind` just like facets and starting equipment
  - feat/spell/sense grant compilers preserve explicit `ALL` vs `SELECTED` semantics
  - grant DTOs now reject `SELECTED` target branches that omit their required ids while accepting explicit `ALL`
  - `packages/shared` and `packages/schema` both typecheck cleanly and both current Vitest slices pass after the grant update
- latest proficiency-grant refinement is now landed and verified:
  - proficiency-grant maps no longer force `authoringModeKind` in the common global/all case
  - proficiency DTOs now validate the real authored branch shape per proficiency kind, including `SELECTED` payload requirements
  - schema coverage now includes explicit-`ALL` and failing selected-without-ids cases for proficiency and grant payloads
- latest class-authoring refinement is now landed and verified:
  - class resources now use `availableAtLevel` instead of `levelAvailable`, matching the feature scheduling language already used elsewhere
  - authored types, node maps, compilers, and schema DTOs now use the same prompt-oriented name
  - current `packages/shared` / `packages/schema` typechecks and both current Vitest slices remain green after the rename
- with the recent shared/helper, grant, character-intent, and class-authoring refinements now landed together, the authored-contract pass appears to have reached the "resume persistence normalization against settled contracts" threshold
- persistence normalization is now moving again against those settled contracts:
  - `shared/tables/saving_throws.sql` now matches the authored union more honestly by allowing `ability_code` only on `FIXED_VALUE` rows and renaming the source-driven branch to `SOURCE_SAVE_DC`
  - `subjects/tables/classes.sql` now uses `available_at_level` for class resources so the DB root matches the settled authored naming
  - `features/tables/features.sql` now uses `available_at_level` for feature availability timing instead of the older string-shaped `level_available` field
  - `subjects/upserts/class.sql` and `shared/upserts/saving_throw.ts` were updated to follow the new contract
  - `features/upserts/feature.sql` now reads `availableAtLevel` from authored JSON and writes `available_at_level`
  - `packages/db` create-database bundle has been regenerated and now includes the settled `SOURCE_SAVE_DC` and `available_at_level` schema changes
  - generated DB types still intentionally lag these table changes until the recreate-and-regenerate checkpoint
- character-state contract narrowing has also started:
  - mutable class state no longer duplicates `classLevel`
  - character progression truth remains in `CharacterIntent`
  - class-scoped `CharacterState` now stays focused on mutable spell/loadout state only
- starting-equipment authoring ergonomics have also improved:
  - equipment-item authoring now defaults to global/all behavior unless explicitly narrowed
  - `authoringModeKind: ALL` is no longer required for the common case
  - the narrowed `SELECTED + equipmentIds` path remains explicit in both maps and schemas
- shared authored scaling abstraction has now been reduced further:
  - grant progression and damage progression now own their leveled-entry helper shapes locally
  - the old shared authored `scaling.ts` helper file has been removed
  - this keeps shared scaling focused on explicit source concepts rather than generic payload containers
- grant scheduling ergonomics have also improved:
  - per-level grant schedules now use `progression` instead of the more generic `scaling` object name
  - feat, spell, and sense grant maps now present that schedule as `Progression`
  - feat, spell, and sense grant compilers and DTO schemas were updated in the same pass so authored, map, compiler, and schema layers stay aligned
- latest equipment-alignment slice is now landed and verified:
  - `equipment_speed` has been removed from source SQL, the recreate bundle, and the live Supabase schema because it is not part of the settled equipment authored contract
  - `packages/db` no longer carries stale authored `speed` assumptions for equipment
  - equipment variants now round-trip through the typed Kysely repository/upsert path instead of failing hydration on persisted `parent_equipment_id`
- latest facet round-trip refinement is now landed and verified:
  - generic facet selection items and the active predicate item tables now persist explicit `sort_order` and hydrate by stored order instead of accidental insertion order
  - selected `PROFICIENCY_GRANT` relation targets now round-trip through shared facet selection tables using persisted `proficiency_kind`
  - selected multi-kind `RANGE` and `DURATION` predicates now round-trip honestly through normalized DB storage instead of being narrowed to a fake single-kind assumption
  - invalid authored mixes still fail explicitly:
    - `DISTANCE` cannot be mixed with other selected range kinds
    - `INSTANTANEOUS` cannot be mixed with timed selected duration kinds
- latest DB contract-alignment refinement is now landed and verified:
  - starting-equipment Kysely writes/reads now fail loudly when selected equipment items omit `equipmentIds`
  - starting-equipment currency items now fail loudly when they omit `currencies`
  - proficiency-grant Kysely writes/reads now match the current authored/compiler split:
    - selected payload fields are only valid on the `SELECTED` branch
    - `ALL` no longer silently persists or hydrates equipment/category/property payload that belongs to the selected branch
  - feat/sense/spell grant Kysely writes/reads now match the same branch rule:
    - selected id payload is only valid on `SELECTED`
    - `ALL` no longer silently persists or hydrates `featIds`, `senseIds`, or `spellIds` at the root or per-level branch
  - spell-grant Kysely writes/reads now also respect attribute-controlled payload applicability from the authored union and node map:
    - `charges` only persists/hydrates when `attributes` includes `LIMITED_USE`
    - `castAtLevel` only persists/hydrates when `attributes` includes `CAST_AT_LEVEL`
  - feat/sense/spell grant Kysely writes/reads now also enforce `selectionKind`-controlled `count` applicability:
    - `count` only persists/hydrates on `CHOSEN`
    - `GRANTED` no longer silently accepts or hydrates `selection_count`
  - modifier/proficiency grant Kysely writes/reads now follow the same authored/core applicability rules:
    - `count` only persists/hydrates on `CHOSEN`
    - proficiency `rounding` only persists/hydrates on `HALF`
  - starting-equipment Kysely writes/reads now also enforce selection-controlled payload applicability:
    - `count` only persists/hydrates on `CHOSEN`
    - `quantity` only persists/hydrates on `GRANTED`
  - `packages/db` currently passes:
    - `npx tsc -p packages/db/tsconfig.build.json --noEmit`
    - `npm --prefix packages/db run build`
    - `npx vitest run packages/db/src/__tests__`
  - current DB Vitest suite count: `19 files / 159 tests`
- latest proficiency-grant TExtra fix is now landed and verified:
  - `Selectable<TSelected, TExtra>` from `allOrSelected.ts` allows TExtra fields on BOTH `ALL` and `SELECTED` branches
  - for `EQUIPMENT` grants: `category` and `properties` are TExtra — valid on ALL mode
  - for `EQUIPMENT_PROPERTY` grants: `category` is TExtra — valid on ALL mode
  - proficiency-grant upsert no longer rejects `category`/`properties` as forbidden on `ALL` mode for EQUIPMENT
  - proficiency-grant hydrator no longer rejects persisted filter rows as forbidden on `ALL` mode for EQUIPMENT
  - test asserting error on ALL + category for EQUIPMENT hydration replaced with a positive round-trip test confirming TExtra hydrates correctly on ALL
  - test asserting error on ALL + category for EQUIPMENT upsert removed from unsupported-upserts suite
  - `EQUIPMENT_PROPERTY` ALL + `properties` rejection is still correct (properties is TSelected for that kind) and its test is untouched
