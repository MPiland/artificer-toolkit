# Phase 5: Server/Application Layer - Internal Reorganization

## Objective

Reorganize `packages/functions` to have a clean separation between typed query modules and use-case orchestration services. Wire the explicit compile-to-assemble data flow. Wire repository read path into services. Retire redundant single-item display queries. No new package is created during this phase.

## Status

Complete.

---

## Architecture Decisions

### Three read/write paths

| Path | Location | Returns | Use case |
| --- | --- | --- | --- |
| `Repository.upsert` | `packages/db/src/repositories/` | `void` | Save authored entity |
| `Repository.findById` / `findAll` | `packages/db/src/repositories/` | `AuthoredXxx` | Load for display AND editing |
| `getXxxListQuery` | `packages/functions/src/queries/` | list/meta projection | List views only |

### Why single-item display queries were retired

The original `getXxxQuery` / `selectXxx` files (e.g. `getBackgroundQuery`, `selectBackground`) returned display shapes that have since drifted from the `AuthoredXxx` contracts due to Phase 4 normalization work. The repositories in `packages/db/src/repositories/` already return fully hydrated `AuthoredXxx` shapes that:

- Round-trip cleanly through `upsert`
- Are correct for both display and editing
- Enforce referential integrity at hydration time

The single-item display queries were therefore redundant and have been deleted. GET single-item routes now call `Repository.findById` directly.

**List queries are kept** — `getXxxListQuery` files return purpose-built projection shapes (list items + cross-entity metadata) that repositories do not replace.

**Fragments — only `details.ts` kept.** The remaining 11 fragment files (`actions`, `damage`, `saveDc`, `speed`, `tags`, `prerequisites`, `charges`, `startingEquipment`, `range`, `duration`, `shape`) were sub-selects for the now-deleted single-item display queries. Nothing imported them. They have been deleted. `details.ts` is retained because it is used by the background, class, and race list queries.

### Engine data access (server-side)

The character engine runs server-side inside the character service (`packages/functions/src/services/character/`). Before the engine evaluates a character it needs the authored content of every class, feat, feature, equipment item, and spell the character references. This content is **not** in the client cache — it is hydrated server-side via repositories.

Flow:

```text
1. Load character → CompiledCharacter (via CharacterRepository or query)
2. For each referenced class/feat/feature/equipment/spell ID:
   → hydrate via repositories (server-side, in character service)
3. Build CharacterAssemblyRegistry from hydrated content
4. Pass CompiledCharacter + registry → engine → ResolvedCharacterState
```

The engine never calls repositories directly. It receives the pre-assembled `CharacterAssemblyRegistry` and operates on that.

---

## Key Framing

`packages/functions` contains two concerns:

- `src/queries/` — typed Kysely list query builders organized by domain (list views only after this phase)
- `src/services/` — use-case orchestration: validate → compile → persist (write), and repository-backed findById/findAll (read)

The `packages/functions` to `packages/server` rename executes after Phase 7 is complete.

---

## Tasks

### 1. Introduce `src/services/`

Status: complete.

### 2. Move Character Assemblers Into Services

Move `src/runtime/assemblers/character/` into `src/services/character/` and update internal imports.

Status: complete.

### 3. Rewrite `src/queries/` List Queries Against Current DB Schema

List query builders stay in place. Single-item queries (`getXxxQuery`, `selectXxx`) retired — see architecture decision above.

All list queries were rewritten against the actual Supabase DB schema (`packages/db/src/types/supabase.database.ts`):

- All imports fixed: `DB` → `DBLike` from `@artificer-toolkit/db`; `@artificer-toolkit/shared/types` and `@artificer-toolkit/functions/types` removed (both were non-existent dist paths); list item/meta types are now defined as local interfaces in each query file
- `getRaceListQuery`: fixed bug where `class_details` was used instead of `race_details`; `sort_order` column name corrected
- `getClassListQuery`: `class_multiclass_rule` table (does not exist) replaced with `class_multiclass` meta; `sort_order` column corrected
- `getEquipmentListQuery`: removed meta sections referencing `damage_fields`, `costs`, `measures` (none exist); replaced with `categories`, `rarities`, `properties`, `features` from actual schema
- `getSpellListQuery`: fully rewritten; removed `action_fields`, `save_dc`, `spell_conditions`, `spell_requirements`, `damage_fields` (none exist); replaced with `attributes`, `classes`, `schools`, `levels`, `castingTimeUnits` from actual schema
- `getSystemListQuery`: removed `is_master` case expression — the `systems` table is app-controlled master data and has no `is_master` column

**List meta pattern:** Queries return `{ items, meta }` where `meta` is a set of inverted indexes mapping dimension values (category IDs, feature IDs, spell school IDs, etc.) to item IDs. This powers client-side filter panels in the UI without fetching full authored objects. TanStack Query caches the result.

**Out of scope for Phase 5:** damage/action meta on equipment/spell lists (requires resolving the `effects → effect_invocations → effect_moments` chain); prerequisite/restriction meta (uses the facets system). These belong to Phase 6+.

Status: complete.

### 4. Wire the Compile-to-Assemble Data Flow

Define and implement the explicit data contract connecting `CompiledCharacterIntent` → `CharacterAssemblyInput` → `ResolvedCharacterState`.

Status: complete — `src/services/character/contract.ts` defines the boundary and resolver.

### 5. Extend Authoring Services with Read Path

Each pipeline (subjects, grants, features) now exposes `findById` and `findAll` in addition to `execute`. Default implementations delegate to the corresponding repository from `packages/db/src/repositories/`.

Status: complete.

Files updated:

- `src/services/subjects/pipeline.ts`
- `src/services/subjects/featAuthoring.ts`
- `src/services/grants/pipeline.ts`
- `src/services/grants/featGrantAuthoring.ts`
- `src/services/features/pipeline.ts`
- `src/services/features/featureAuthoring.ts`

### 6. Add `handleAuthoringRequest` Utility

`src/utils/handleAuthoringRequest.ts` — parallel to `handleRequest` but for POST/PUT. Parses JSON body, authenticates, sets RLS context, runs a service callback. `parseBody` is a caller-supplied identity function for now; Phase 7 replaces it with Zod schema parsing.

Status: complete.

### 7. Wire Routes

- `features.ts` wired into `apps/apis/src/routes/index.ts`
- `apps/apis/src/routes/feats.ts` created with POST handler calling `createFeatSubjectAuthoringService`
- `apps/apis/src/routes/featGrants.ts` created with POST handler calling `createFeatGrantAuthoringService`
- `apps/apis/src/routes/features.ts` extended with POST handler calling `createFeatureAuthoringUseCaseService`
- GET single-item route handlers updated to call `Repository.findById` instead of deleted query functions

Status: complete.

### 8. Package Rename Deferred Trigger

The `packages/functions` to `packages/server` rename executes after Phase 7 is complete once API routes are stable and consuming these services.

Status: deferred (unchanged).

---

## Package Dependency Rules

`packages/functions` may depend on:

- `packages/shared`
- `packages/schema`
- `packages/db`

`packages/functions` must not depend on:

- `apps/apis`
- `apps/web`

---

## Exit Criteria

All met:

- `src/services/` exists with character assembly and authoring use cases (subjects/grants/features)
- Character assemblers live in `src/services/character/`
- `src/queries/` retains only list queries and fragments
- Single-item display queries deleted; GET routes use repositories
- Compile-to-assemble data contract implemented as typed TypeScript
- Authoring services expose both write (`execute`) and read (`findById`, `findAll`) paths
- Phase 6 engine has a defined typed input (`ResolvedCharacterState`) and a defined registry hydration contract
- `packages/functions` typechecks cleanly

---

## Handoff Note for Phase 6

- Engine input type: `ResolvedCharacterState` from `src/services/character/contract.ts`
- Engine receives `CharacterAssemblyRegistry` pre-populated by the character service — the service hydrates all referenced content via repositories before calling the engine
- Engine must not import from `packages/db` directly — all data arrives through the registry
- `CharacterAssemblyRegistry` currently only has `features`; Phase 6 must expand it to cover classes, feats, equipment, and spells as the engine resolution rules require them
- Rule ordering document is a mandatory pre-implementation gate for Phase 6 (see `REBUILD_PLAN.md`)

---

## Testing

Use `vitest`. Tests live in `src/__tests__/service-orchestration.test.ts`.

Coverage includes:

- Write pipeline order (validate → compile → persist) for subjects, grants, features
- Read path delegation (findById, findAll) for subjects, grants, features
- Character assembly contract boundary

Real payload integration tests are Phase 7 scope (requires seed data).

Verification commands:

```bash
yarn tsc --build packages/functions/tsconfig.build.json --noEmit
npx vitest run packages/functions/src/__tests__
```
