# Phase 7 — API Transport Stabilization

## Status: In Progress

## Context

Phase 6.5 delivered the complete character lifecycle domain layer: `CharacterBuildState`, `CharacterEvent` union (14 types), 10 command handlers, `snapshotBuilder`, `contentAccess` stub, `character_events` SQL table and repository, and a full engine pipeline. None of this is wired to the DB or exposed via API routes yet.

Phase 7's job is transport stabilization: connect the domain layer to the database, enforce Zod validation at all API boundaries, and expose character management through HTTP routes. No new domain behavior is added.

**Deferred to Phase 8:** condition/exhaustion tracking (`character_play_state` table, play-event union, engine `activeConditions` input). Vocabulary and PENALTY stacking infrastructure exist; domain work belongs in its own phase.

---

## Architectural Decisions

### State Storage: Persisted Snapshot

`CharacterBuildState` is stored as a `build_state jsonb` column on `characters`, not rebuilt from the event log on every load. Reasons:

- `CharacterBuildState` is already named "canonical persisted current build" in the code
- Command handlers already return `newState` for free — no extra projection needed
- O(1) load vs O(n) replay; 20–50 events per character is not worth the complexity
- `stream_version` on the row enables a simple atomic optimistic concurrency check

`character_events` remains the audit trail and recovery path — events always appended even when snapshot is updated.

### `stream_version` Placement

Top-level `stream_version integer not null default 0` column on `characters` is the authoritative concurrency guard. `CharacterBuildState.streamVersion` in the blob mirrors it. Both updated together on every write; the column is what the `UPDATE ... WHERE stream_version = expected` check targets.

### Command Route Shape

Single `POST /characters/:id/commands` with a flat discriminated body:

```ts
{ type: 'GAIN_CLASS_LEVEL', expectedVersion: 3, classRef: {...}, ... }
```

Zod discriminated union validates the full payload. One dispatch path handles all shared concerns: auth, load, validate, dispatch, transact, respond.

### Validation: Retrofit All Routes

All existing content authoring routes get Zod validation at the route boundary in Phase 7. Schemas already exist in `packages/schema` — this is pure wiring. Introduces consistent 422 error shape across the entire API.

---

## Part 1 — DB Migration

### Modify `characters` table

`packages/db/src/domains/subjects/tables/characters.sql` — add:

```sql
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS build_state jsonb,
  ADD COLUMN IF NOT EXISTS stream_version integer NOT NULL DEFAULT 0;
```

`build_state` is nullable initially; lifecycle service returns 404 for commands on rows with null `build_state`.

### Apply `character_events` migration

`packages/db/src/domains/subjects/tables/character_events.sql` — apply to Supabase via MCP (not yet migrated to live project).

### Regenerate DB types

After migrations land, regenerate `packages/db/src/types/supabase.database.ts` so `characters.build_state`, `characters.stream_version`, and `character_events` are properly typed — removing all `as any` casts in the event repository.

---

## Part 2 — `CharacterRepository`

**New file:** `packages/db/src/domains/subjects/repositories/character.ts`

```typescript
export interface CharacterRepository {
  create(params: { id: string; systemId: string; userId: string; label: string; buildState: CharacterBuildState }): Promise<void>
  findById(id: string): Promise<CharacterRow | null>
  updateBuildState(params: { id: string; buildState: CharacterBuildState; expectedVersion: number }): Promise<void>
  listByUser(userId: string): Promise<Pick<CharacterRow, 'id' | 'label' | 'system_id' | 'stream_version'>[]>
}

export class ConcurrencyError extends Error {}

export function createCharacterRepository(db: DBLike): CharacterRepository
```

`updateBuildState` uses an atomic compare-and-swap:

```sql
UPDATE characters
SET build_state = $newState, stream_version = $newVersion, updated_at = now()
WHERE id = $id AND stream_version = $expectedVersion
```

Zero rows updated → throw `ConcurrencyError`.

Export from `packages/db/src/domains/subjects/repositories/index.ts`.

---

## Part 3 — `CharacterLifecycleService`

**New file:** `packages/functions/src/services/character/lifecycleService.ts`

```typescript
export async function dispatchCharacterCommand<TCommand, TResult>(
  characterId: string,
  expectedVersion: number,
  command: TCommand,
  handler: CommandHandler<TCommand, TResult>,
  db: DBLike
): Promise<{ newState: CharacterBuildState; events: CharacterEvent[]; result: TResult }>
```

**Steps:**

1. `CharacterRepository.findById(characterId)` — throw `NotFoundError` if missing or `build_state` is null
2. Build `CharacterAssemblyRegistry` from DB (class/feat/spell/equipment repos; feature assembly stubbed)
3. Call `handler(command, currentState, registry, dnd5e2014RulesSystem)`
4. Verify `currentState.streamVersion === expectedVersion` — throw `ConcurrencyError` if mismatch
5. `CharacterEventRepository.appendBatch(events)`
6. `CharacterRepository.updateBuildState({ id: characterId, buildState: newState, expectedVersion })`
7. Return `{ newState, events, result }`

Export from `packages/functions/src/services/character/index.ts`.

---

## Part 4 — Request Handler Evolution

### Modify `packages/functions/src/utils/handleAuthoringRequest.ts`

Add Zod overload alongside existing `parseBody` signature:

```typescript
// existing (kept for backward compat)
handleAuthoringRequest(handler, parseBody)

// new Zod overload
handleAuthoringRequest(schema: ZodType<TBody>, handler)
```

Zod parse errors produce a structured 422:

```json
{ "error": "Validation failed", "issues": [...] }
```

### New file: `packages/functions/src/utils/handleCommandRequest.ts`

Thin wrapper for the single command dispatch route — extracts `:id` from path, reads `expectedVersion` from body, calls `dispatchCharacterCommand`. Returns:

- `200` on success
- `404` if character not found
- `409` on `ConcurrencyError`
- `422` on Zod failure

Export from `packages/functions/src/utils/index.ts`.

---

## Part 5 — Character API Routes

**New file:** `apps/apis/src/routes/characters.ts`

```typescript
// GET /characters           — list user's characters
export const listCharacters

// POST /characters          — create character (runs handleCreateCharacter + persists)
export const createCharacter

// GET /characters/:id       — get resolved character sheet (EngineCharacterOutput)
export const getCharacter

// POST /characters/:id/commands — dispatch a build command
export const dispatchCommand

// GET /characters/:id/history   — event log as CharacterHistoryView
export const getCharacterHistory
```

Add `export * from './characters.js'` to `apps/apis/src/routes/index.ts`.

### `characterCommandUnionSchema`

Add to `packages/schema/src/domains/character/commands/index.ts`:

```typescript
export const characterCommandUnionSchema = z.discriminatedUnion('type', [
  createCharacterCommandSchema,
  assignAbilityScoresCommandSchema,
  gainClassLevelCommandSchema,
  applyHitPointsCommandSchema,
  makeFeatureSelectionCommandSchema,
  chooseFeatCommandSchema,
  updateSpellSelectionCommandSchema,
  acquireEquipmentCommandSchema,
  equipItemCommandSchema,
  unequipItemCommandSchema,
])
export type CharacterCommandUnion = z.infer<typeof characterCommandUnionSchema>
```

---

## Part 6 — `CharacterHistoryView`

**New file:** `packages/shared/src/domains/character/historyView.ts`

```typescript
export interface CharacterHistoryEntry {
  eventId: string
  occurredAt: string
  actorId: string
  summary: string      // e.g. "Gained level 3 Fighter"
  eventType: string
}

export interface CharacterHistoryView {
  characterId: string
  entries: CharacterHistoryEntry[]
}

export function buildCharacterHistoryView(events: CharacterEvent[]): CharacterHistoryView
```

Export from `packages/shared/src/barrels/core/index.ts`.

---

## Part 7 — Retrofit Zod on Existing Content Routes

Wire existing `packages/schema` schemas into `handleAuthoringRequest` for all content write routes:

| Route file | Handler | Schema |
|---|---|---|
| `classes.ts` | `createClass` | class authored schema |
| `races.ts` | `createRace` | race authored schema |
| `spells.ts` | `createSpell` | spell authored schema |
| `feats.ts` | `createFeat` | feat authored schema |
| `equipment.ts` | `createEquipment` | equipment authored schema |
| `backgrounds.ts` | `createBackground` | background authored schema |
| `features.ts` | `createFeature` | feature authored schema |
| `featGrants.ts` | `createFeatGrant` | feat grant schema |
| `system.ts` | `createSystem` | system authored schema |

If a schema is not yet exported from `packages/schema`, add the export rather than skipping validation.

---

## Critical Files

### New

- `packages/db/src/domains/subjects/repositories/character.ts`
- `packages/functions/src/services/character/lifecycleService.ts`
- `packages/functions/src/utils/handleCommandRequest.ts`
- `apps/apis/src/routes/characters.ts`
- `packages/shared/src/domains/character/historyView.ts`

### Modified

- `packages/db/src/domains/subjects/tables/characters.sql` — add `build_state`, `stream_version`
- `packages/db/src/domains/subjects/repositories/index.ts` — add `character.ts` export
- `packages/db/src/domains/subjects/repositories/characterEvent.ts` — remove `as any` after regen
- `packages/functions/src/utils/handleAuthoringRequest.ts` — Zod overload
- `packages/functions/src/utils/index.ts` — export `handleCommandRequest`
- `packages/functions/src/services/character/index.ts` — export lifecycle service
- `packages/schema/src/domains/character/commands/index.ts` — add `characterCommandUnionSchema`
- `packages/shared/src/barrels/core/index.ts` — add `historyView.js`
- `apps/apis/src/routes/index.ts` — add `characters.js`
- All 9 content route files — wire Zod schemas

### Supabase migrations (via MCP)

- `characters`: add `build_state`, `stream_version`
- `character_events`: apply existing SQL

---

## Exit Criteria

1. `npx tsc -p packages/db/tsconfig.build.json --noEmit` — clean
2. `npx tsc -p packages/functions/tsconfig.build.json --noEmit` — clean
3. `npx tsc -p apps/apis/tsconfig.build.json --noEmit` — clean
4. `npx vitest run packages/db/src/__tests__` — all DB tests pass
5. `npx vitest run packages/shared/src/__tests__` — all 40 engine tests pass
6. **Lifecycle:** `createCharacter` → `gainClassLevel` → load → `streamVersion === 2` ✅
7. **Concurrency:** two concurrent `gainClassLevel` commands — second returns 409 ✅
8. **History:** after 3 commands, history endpoint returns 3 entries with correct summaries ✅
9. **Command validation:** `POST /characters/:id/commands` with unknown `type` → 422 ✅
10. **Content validation:** `POST /classes` with missing required field → 422 ✅
11. Supabase MCP: `character_events` and `characters.build_state` visible in schema ✅

---

## Deferred to Phase 8

- Condition/exhaustion tracking (`character_play_state`, play-event union, engine `activeConditions`)
- Spell slot / resource depletion (mutable play-state)
- Full feature assembly pipeline (`snapshot.features[]`)
- `resolvePendingChoices` full implementation
- `CompiledPrerequisite` on feat compiler
- Marketplace entitlement enforcement
- Frontend (`apps/web`)
