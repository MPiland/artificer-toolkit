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
| DB upserts (SQL) | Being removed | `.sql` files are shifting to schema/bootstrap only; legacy `upsert_*` procedures are being retired in favor of Kysely writes |
| DB upserts (TS) | Partial | Shared + subject + grant + feature write modules exist, but Phase 4 now requires porting them to Kysely-owned writes instead of SQL-procedure wrappers |
| Query functions | Complete | The functions workspace already has broad coverage |
| `packages/schema` | Complete | Runtime DTO coverage now spans subjects/shared/effects/grants/features/vocabulary/api; correlated modifier/facet payload validation is in place and schema tests pass |
| Character assemblers | Present | Need later reorganization into server/application + engine |
| Rule engine | Missing | Still a future phase |
| API routes | Minimal | Need validation and stabilization later |
| SRD data | Partial | Canonical source-data contracts, an initial SRD bundle file, and seed orchestration exist; real SRD content population is still pending |
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
| Phase 4 - DB wrappers, canonical source data, and SRD seed pipeline | In progress | `packages/db` now typechecks and the deferred-constraint path covers shared/effects/features/grants/subjects cross-domain FKs, but persistence-shape work is now gated on a full authored-contract audit before more table-shape decisions land |
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
11. Serious SRD seed population is gated on a full normalization audit of all persisted authored-data tables.
12. `.sql` files are schema/bootstrap only. Kysely owns application writes and seed upserts.
13. Persistence shape follows authored contracts. If authored contracts are under audit, Phase 4 table-shape decisions pause until that audit is closed.

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
- [x] Complete `PHASE_4_NORMALIZATION_AUDIT.md` for all persisted authored-data tables.
- [x] Record first-pass verdicts for shared authored infrastructure.
- [x] Record grant-table verdicts, including the modifier/proficiency hotspots.
- [x] Record feature/option-table verdicts.
- [x] Record subject-root verdicts.
- [x] Record effect-table verdicts.
- [x] Record character-persistence verdicts.
- [x] Land the first Phase 4 SQL normalization refactor tranche for grant tables (`modifiers.sql` and `proficiencies.sql`).
- [x] Land the second Phase 4 SQL normalization refactor tranche for the feature domain (`features.sql`, `options.sql`, and aligned feature upserts).
- [x] Lock the Phase 4 rule that SQL `upsert_*` functions are being retired and Kysely owns writes going forward.
- [x] Remove the legacy character SQL upsert functions from [`packages/db/src/domains/subjects/tables/characters.sql`](c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/domains/subjects/tables/characters.sql).
- [x] Fix the DB type-generation script to target the canonical generated file at [`packages/db/src/types/supabase.database.ts`](c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/types/supabase.database.ts).
- [x] Tighten the shared-helper SQL shapes for [`charges.sql`](c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/domains/shared/tables/charges.sql) and [`starting_equipment.sql`](c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/domains/shared/tables/starting_equipment.sql).
- [x] Remove stale authored-root drift from the subject tables for classes, equipment, feats, and spells.
- [x] Remove character spell-slot persistence and tighten the authored-aligned invariants in [`packages/db/src/domains/subjects/tables/characters.sql`](c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/domains/subjects/tables/characters.sql).
- [x] Realign character hitpoint intent and point-buy / standard-array persistence to the current authored contracts in [`packages/db/src/domains/subjects/tables/characters.sql`](c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/domains/subjects/tables/characters.sql).
- [x] Move manual-rolled character ability persistence to the authored roll-group shape in [`packages/db/src/domains/subjects/tables/characters.sql`](c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/domains/subjects/tables/characters.sql).
- [x] Remove `public.upsert_json_array(...)` from the schema/bootstrap utility SQL so the recreate bundle stops reintroducing a write helper from [`packages/db/src/domains/utils/tables/utils.sql`](c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/domains/utils/tables/utils.sql).
- [x] Create the authored-contract audit gate at [`PHASE_4_AUTHORED_CONTRACT_AUDIT.md`](c:/Users/pilan/Desktop/artificer-toolkit/PHASE_4_AUTHORED_CONTRACT_AUDIT.md).
- [x] Complete the authored-contract audit and lock the next authored-type redesigns before more Phase 4 persistence-shape work.
- [x] Apply the authored-contract audit reshapes through `packages/shared` and `packages/schema` before resuming deeper Phase 4 persistence refactors.
- [x] Land the first authored-contract refactor slice for explicit scaling references, charge-limit source naming, and damage-local pool scaling in `packages/shared` and `packages/schema`.
- [x] Land the second authored-contract refactor slice for feature scheduling ergonomics (`availableAtLevel` and `optionChoices`) in `packages/shared` and `packages/schema`.
- [x] Narrow character mutable state so class progression truth remains in `CharacterIntent` and class-scoped `CharacterState` only stores mutable play state.
- [x] Make starting-equipment equipment-item authoring default to global/all behavior unless explicitly narrowed.
- [x] Remove the shared authored leveled-scaling helper and localize grant/damage progression-entry shapes to their owning domains.
- [x] Rename per-level grant schedules from `scaling` to `progression` and carry the matching map/compiler/schema updates in the same pass.
- [x] Keep facet/selectable authoring explicit and enforce the `ALL` vs `SELECTED` payload split consistently.
- [x] Rename shared saving-throw source usage from `SPELL_SAVE_DC` to `SOURCE_SAVE_DC` so feature-owned save DC usage is modeled honestly.
- [x] Make character starting-equipment intent use stable authored `groupId` / `optionId` references instead of array indexes.
- [x] Keep grant payload authoring explicit and tighten DTO validation for `SELECTED` target branches.
- [x] Keep proficiency-grant authoring explicit and validate per-kind selected payload requirements in schema.
- [x] Align class resource scheduling language to `availableAtLevel` so class-owned prompts use the same author-facing wording as features.
- [x] Resume Phase 4 SQL normalization against the settled authored contracts for saving throws and class resource scheduling.
- [x] Align feature-root SQL availability timing to `available_at_level` so persistence matches the settled `availableAtLevel` authored contract.
- [x] Regenerate the create-database bundle after the latest settled-contract SQL refactors so bootstrap SQL matches current table definitions.
- [x] Remove stale feature, option, and grant trait persistence from the SQL schema and legacy SQL upsert sources so recreate no longer carries authored fields that were removed from the settled contracts.
- [x] Align feature option-level persistence to the settled `optionChoices` model and remove the stale per-level `optionIds` link table from Phase 4 SQL.
- [x] Persist class spellcasting `prepareLimit.perLevel` in both the class compiler and Phase 4 SQL so authored prepare-limit tables round-trip cleanly.
- [x] Persist class spellcasting attributes through a real owned `class_spellcasting_attributes` table and remove the stale `class_spellcasting_traits` write path.
- [x] Reshape class multiclass persistence to the settled `requirementGroups -> requirements` authored model and remove the dead recursive SQL helper.
- [x] Remove the last stale subject-root trait deletes from the legacy `spell.sql`, `equipment.sql`, and `feat.sql` upsert sources.
- [x] Align character class-spell state and resource-usage persistence to the settled `CharacterState` and `CharacterResourceGrantRecord` contracts.
- [x] Remove redundant ancestry-option persistence from `character_race` so race identity and ancestry acquisitions are not stored twice.
- [x] Align all character `subclassId` provenance references to subclass class rows instead of subtype rows.
- [x] Align character starting-equipment session field names to the settled authored `applied` wording.
- [x] Persist `acquiredParentId` for option-derived character provenance across feature acquisitions, spell selections, and resource grants.
- [x] Add a `value_kind` payload correlation check to character feature-selection values.
- [x] Align character ability-generation persistence to the settled authored model by storing explicit `method_code` and renaming manual-rolled assignments away from the misleading `manual_overrides` terminology.
- [x] Align shared charge-limit persistence to the settled authored scaling refs so DB tables/helpers support `CLASS_LEVEL`, `PARENT_CLASS_LEVEL`, and `SPELL_CAST_LEVEL` instead of writing legacy `SOURCE_LEVEL`.
- [x] Remove stale scaling `spell_id` storage from damage, feat-grant, spell-grant, and sense-grant persistence so the DB follows `SPELL_CAST_LEVEL` semantics instead of base-spell identity.
- [x] Remove the remaining legacy SQL grant procedures (`feat`, `proficiency`, `sense`, and `spell`) and convert their TS write modules into explicit placeholders until real Kysely writes land.
- [x] Remove the legacy SQL feature and option procedures and convert their TS write modules into explicit placeholders until real Kysely writes land.
- [x] Remove the legacy SQL effect procedure tree and convert `effect.ts` into an explicit placeholder until real Kysely writes land.
- [x] Remove the legacy SQL starting-equipment procedure tree and convert `starting_equipment.ts` into an explicit placeholder until real Kysely writes land.
- [x] Remove the remaining legacy SQL subject-root and system procedures and convert their TS write modules into explicit placeholders until real Kysely writes land.
- [x] Remove the legacy SQL `upsert_charge(...)` and `upsert_json_array(...)` helpers so the repo no longer exposes an intended SQL write API.
- [x] Tighten the table SQL for authored-default selection modes, optional grant charges, required class spellcasting charges, and race/equipment root invariants before recreate.
- [x] Align effect moment table persistence with the authored contracts by keeping moment ids and roll-table entry descriptions.
- [x] Complete the local recreate-readiness sweep by removing stale spell-grant trigger naming drift and stale character references to deleted `race_subtypes` / `system_abilities` tables.
- [x] Remove the dead `equipment_speed` table from the source SQL, recreate bundle, and live Supabase schema so DB shape matches the settled equipment authored contract.
- [x] Support equipment variant round-tripping in `packages/db` so persisted `parent_equipment_id` rows hydrate and rewrite honestly.
- [x] Persist facet selection/predicate ordering explicitly and hydrate facet arrays by stored `sort_order` instead of insertion order.
- [x] Support selected `PROFICIENCY_GRANT` relation targets plus selected multi-kind `RANGE` / `DURATION` facet payloads in the normalized DB layer.
- [x] Tighten `packages/db` starting-equipment and proficiency-grant Kysely reads/writes so branch-only payload fields match the authored/core contracts instead of silently hydrating looser DB-only shapes.
- [x] Tighten feat/sense/spell grant Kysely reads/writes so `ALL` branches reject selected-only ids instead of silently dropping them at write/hydration time.
- [x] Tighten spell-grant Kysely reads/writes so attribute-controlled fields (`charges`, `castAtLevel`) only apply when their controlling attributes are present.
- [x] Tighten feat/sense/spell grant Kysely reads/writes so `count` only applies on `CHOSEN` branches and never silently survives on `GRANTED`.
- [x] Tighten feat/sense/spell grant table SQL so root/scaling discriminators, positive authored ordering, and per-grant level uniqueness are enforced before recreate.
- [x] Tighten modifier/proficiency grant Kysely reads/writes so `count` only applies on `CHOSEN`, and proficiency `rounding` only applies on `HALF`.
- [x] Tighten starting-equipment Kysely reads/writes so `count` only applies on `CHOSEN` and `quantity` only applies on `GRANTED`.
- [x] Fix proficiency-grant TExtra applicability: `Selectable<TSelected, TExtra>` allows TExtra fields on BOTH `ALL` and `SELECTED` branches; for `EQUIPMENT` grants `category`/`properties` are TExtra (valid on ALL), and for `EQUIPMENT_PROPERTY` grants `category` is TExtra (valid on ALL); upsert and hydrator no longer reject these fields on ALL mode, and the test suite was updated to replace the incorrect negative assertions with a positive round-trip test.
  - [ ] Refactor all Phase 4 `Refactor before seed` SQL table groups before recreate/populate.
- [x] Verify the empty-database bootstrap against Supabase main; the linked project accepted the regenerated bootstrap bundle end to end after a destructive `public` reset and migration-history repair, so no new recreate failure cluster remains at this checkpoint.
- [x] Regenerate DB types immediately after the recreated database matches the normalized schema.
- [ ] Standardize the Kysely DB surface on the regenerated canonical type file only.
- [ ] Port the remaining subject/grant/feature/effect/system write modules from SQL-procedure wrappers to typed Kysely writes.
- [ ] Add more repository hydration implementations beyond systems.
- [ ] Start filling the canonical baseline source-data bundle with real SRD content.

Latest Phase 4 implementation note:

- the active DB round-trip surface is now being audited against authored types plus their core/map/compiler context, not just TypeScript permissiveness
- recent completed slices include:
  - facet ordering persisted through explicit `sort_order`
  - selected multi-kind `RANGE` / `DURATION` facet round-tripping
  - selected `PROFICIENCY_GRANT` facet relation targeting
  - stricter starting-equipment and proficiency-grant branch enforcement in Kysely writes/reads
  - stricter feat/sense/spell grant branch enforcement so `ALL` branches no longer silently accept selected-only ids
  - stricter spell-grant attribute applicability so `charges` and `castAtLevel` only round-trip when their controlling attributes are present
  - stricter feat/sense/spell grant `count` applicability so `GRANTED` no longer round-trips `selection_count`
  - stricter feat/sense/spell grant table invariants so root/scaling discriminators, positive authored ordering, and per-grant level uniqueness are enforced in recreate SQL
  - stricter modifier/proficiency applicability so `GRANTED` no longer round-trips `count`, and non-`HALF` proficiency grants no longer round-trip `rounding`
  - stricter starting-equipment applicability so `GRANTED` no longer round-trips `count`, and `CHOSEN` no longer round-trips `quantity`
  - proficiency-grant TExtra applicability fix: `category`/`properties` are TExtra for `EQUIPMENT` and `category` is TExtra for `EQUIPMENT_PROPERTY`, so both are valid on `ALL` mode; tests corrected accordingly
  - destructive linked-project bootstrap verification succeeded after resetting `public`, repairing stale remote migration history, and pushing the generated bootstrap bundle through Supabase CLI
  - `packages/db/src/types/supabase.database.ts` has been regenerated from the recreated linked schema
- current verification snapshot for `packages/db`:
  - `npx tsc -p packages/db/tsconfig.build.json --noEmit`
  - `npm --prefix packages/db run build`
  - `npx vitest run packages/db/src/__tests__`
  - DB suite currently passes at `19 files / 159 tests`

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
