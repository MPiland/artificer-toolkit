# Phase 6.5: Character Lifecycle & Full Engine Architecture

## Objective

Extend the Phase 6 engine kernel into a complete character management system. A character with
any combination of SRD or homebrew classes/races/feats/equipment should be fully creatable,
levelable, and have their complete character sheet derived — with full history of every decision
preserved.

**Phase 6 delivered:** pure engine kernel (runEngine, RulesSystem, grant → modifier → derived stats, 36 tests).

**Phase 6.5 delivers:** equipped-item tracking, armor AC, spell slot maximums, class resource
maximums, prerequisite evaluation, character lifecycle events, build state, choice resolution,
command layer, lifecycle service.

**Intentionally out of scope:** damage rolls, condition tracking, combat simulation, spell
slot/resource depletion (play-state), encounter tracking.

---

## Status: Complete

All exit criteria met. 40 engine tests pass (232 total across full suite).
All four packages typecheck clean.

---

## Revised Phase Sequence

| Phase | Status |
|---|---|
| Phase 6 — Engine kernel | Complete (foundation) |
| Phase 6.5 — Character lifecycle + full engine | **This plan — in progress** |
| Phase 7 — API transport stabilization | Pending (builds on 6.5) |
| Phase 8 — Frontend rewrite | Pending |

**Critical:** Phase 7 API transport must NOT be stabilized before Phase 6.5 is complete.
Phase 7 exposes Phase 6.5's command layer and read models.

---

## Package Placement

All new engine and character lifecycle code stays in **`packages/shared`**. No new workspace.

- `packages/shared` is pure domain logic with no runtime dependencies — all new additions fit
- `packages/shared` → `packages/domain` rename is planned for a later dedicated structural pass
- Extract to `packages/engine` only if the engine gains heavyweight deps or needs distinct release cadence

Internal organization:
- `src/domains/engine/` — kernel, resolution pipeline, resolvers, dnd5e2014 rules
- `src/domains/character/` — events, build state, content refs

---

## Architecture

```
Authored Content (Phases 1–5)
  packages/shared   — domain types, node maps, compilers
  packages/db       — repositories for compiled content

Character Lifecycle Domain  [packages/shared/src/domains/character/]
  events/           — CharacterEvent union (immutable, timestamped)
  buildState.ts     — CharacterBuildState (canonical persisted current build)
  contentRef.ts     — ContentRef (version-aware content reference)

Engine  [packages/shared/src/domains/engine/]
  kernel.ts             — runEngine(snapshot, registry, rules): EngineCharacterOutput
  registry.ts           — CharacterAssemblyRegistry (moved from packages/functions)
  snapshot.ts           — CharacterBuildSnapshot (ephemeral engine input)
  choiceResolver.ts     — resolvePendingChoices (pure; shared by engine + command handlers)
  prerequisiteEval.ts   — evaluatePrerequisites (entry + ongoing restriction seam)
  resolution/
    grantApplicator.ts      — moved from packages/functions
    modifierResolver.ts     — moved from packages/functions
    derivedStatCalculator.ts — moved + extended with armor-aware AC
    spellSlotResolver.ts    — NEW: multiclass-aware slot table
    resourceResolver.ts     — NEW: class resource max resolution
    index.ts
  dnd5e2014/
    spellSlotTable.ts   — NEW: 5e slot progression tables
    (existing files unchanged)

Application Layer  [packages/functions/src/services/character/]
  commands/             — command handlers (validate → emit events → update build state)
  lifecycleService.ts   — orchestrate: load state, command, concurrency, persist, project
  snapshotBuilder.ts    — build CharacterBuildSnapshot from CharacterBuildState + registry
  contentAccess.ts      — entitlement stub (always GRANTED; enforced in marketplace phase)

Transport Contracts  [packages/schema/src/domains/character/commands/]
  CreateCharacterCommand, AssignAbilityScoresCommand, GainClassLevelCommand, etc.
```

---

## Part 1 — Move Engine Kernel to `packages/shared`

### Files to create/move

| Action | From | To |
|---|---|---|
| Move | `packages/functions/src/services/character/engine.ts` | `packages/shared/src/domains/engine/kernel.ts` |
| Move | `packages/functions/src/services/character/resolution/*.ts` | `packages/shared/src/domains/engine/resolution/` |
| Move | `packages/functions/src/services/character/types.ts` | `packages/shared/src/domains/engine/registry.ts` |
| Move | `packages/functions/src/__tests__/engine.test.ts` | `packages/shared/src/__tests__/engine.test.ts` |
| Add | — | `packages/shared/src/domains/engine/snapshot.ts` |

**`CharacterAssemblyRegistry` moves to `packages/shared`** — it is a pure type referencing only
compiled domain types already in `packages/shared`. No runtime deps, so it belongs here.

After move, update resolution file imports:
- `'../types.js'` → `'../registry.js'`
- `'@artificer-toolkit/shared'` stays the same (still valid from within shared via relative paths)

`packages/functions` `types.ts` becomes a re-export shim:
```typescript
// packages/functions/src/services/character/types.ts
export type { CharacterAssemblyRegistry, CharacterAssemblyRegistryFeature } from '@artificer-toolkit/shared'
```

### Barrel updates

`packages/shared/src/barrels/core/index.ts` — add:
```typescript
export * from '../../domains/engine/registry.js'
export * from '../../domains/engine/kernel.js'
export * from '../../domains/engine/snapshot.js'
export * from '../../domains/engine/resolution/index.js'
export * from '../../domains/engine/choiceResolver.js'
export * from '../../domains/character/events/index.js'
export * from '../../domains/character/buildState.js'
export * from '../../domains/character/contentRef.js'
```

---

## Part 2 — Extended Engine Output

### New types in `packages/shared/src/domains/engine/contracts/engineState.ts`

```typescript
export interface EngineSpellSlots {
  maxByLevel: Record<number, number>      // slot level 1–9 → max count
  pactMagic?: { slots: number; level: number }
  fusionStrategy: 'NONE' | 'SINGLE_CLASS' | 'MULTICLASS_FUSED'
}

export interface EngineResource {
  resourceId: string
  label: string
  maxCount: number
  rechargeOn: 'SHORT_REST' | 'LONG_REST' | 'DAWN' | 'CUSTOM'
  sourceFeatureId: string
}

export interface EngineItemContribution {
  instanceId: string
  contentId: string
  modifiersApplied: string[]
}
```

### Extended `EngineCharacterOutput`

```typescript
export interface EngineCharacterOutput {
  characterId: string
  systemId: string
  proficiencies: EngineProficiency[]
  senses: EngineSense[]
  derivedStats: EngineDerivedStats       // armorClass now includes equipped armor
  spellSlots: EngineSpellSlots           // NEW
  resources: EngineResource[]            // NEW
  activeItemContributions: EngineItemContribution[]  // NEW
}
```

---

## Part 3 — Equipment: Equipped State

### `EquippedState` discriminated union

```typescript
// packages/shared/src/domains/engine/snapshot.ts
export type EquippedState =
  | { slot: 'ARMOR' }
  | { slot: 'SHIELD' }
  | { slot: 'MAIN_HAND' }
  | { slot: 'OFF_HAND' }
  | { slot: 'RING'; position: 1 | 2 }
  | { slot: 'GENERIC' }    // active but not slotted (e.g. cloak, boots)
```

### `OwnedEquipmentInstance`

```typescript
export interface OwnedEquipmentInstance {
  instanceId: string
  contentRef: ContentRef
  quantity: number
  equippedState?: EquippedState
}
```

Key rule: **only equipped items contribute modifiers to the engine**. Owned-but-unequipped
items are in inventory and ignored for stat resolution (unless authored content flags them
as always-active, handled through their compiled grant data).

### `CharacterBuildSnapshot`

```typescript
export interface CharacterBuildSnapshot {
  characterId: string
  systemId: string
  totalLevel: number
  classes: Array<{ classId: string; level: number; subclassId?: string }>
  abilities: Record<string, number>         // resolved scores
  hitpoints: Array<{ classId: string; classLevel: number; value: number }>
  features: CharacterAssembledFeature[]
  equippedItems: Array<{
    instanceId: string
    contentRef: ContentRef
    equippedState: EquippedState
    compiledItem: CompiledEquipment | CompiledEquipmentVariant
  }>
}
```

### Armor-aware AC in `derivedStatCalculator.ts`

New resolution path in step 9 (AC calculation):
1. Check `snapshot.equippedItems` for an item with `equippedState.slot === 'ARMOR'`
2. If found: base AC = `compiledItem.armorClass` (field on `CompiledEquipmentBase`)
3. DEX cap by armor **property** (not a separate enum — check `compiledItem.properties`):
   - `LIGHT` in properties → full DEX modifier
   - `MEDIUM` in properties → min(DEX modifier, 2)
   - `HEAVY` in properties → 0 DEX bonus
4. If item with `equippedState.slot === 'SHIELD'` equipped: +2 AC
5. If no armor equipped: base AC = 10 + full DEX modifier (existing behavior)
6. Add `ARMOR_CLASS:BONUS` domain modifiers on top

Armor category comes from `compiledItem.category` (`ARMOR` or `SHIELD` from `EQUIPMENT_CATEGORY_CODE`).
Armor weight class comes from `compiledItem.properties` array (`LIGHT`, `MEDIUM`, `HEAVY` from `EQUIPMENT_PROPERTY_CODE`).

---

## Part 4 — Spell Slot Tracking

### Spell slot data already in compiled form

**Key finding:** `CompiledSpellcasting.spellLimits: CompiledSpellLimits[]` already stores the
per-level slot table directly on the compiled class. There is no `casterType` enum — each class's
slot progression is authored explicitly as a table.

```typescript
// Already in packages/shared/src/domains/subjects/compilers/class.ts
interface CompiledSpellLimits {
  classLevel: number
  slots: CompiledSpellSlot[]         // [{ spellLevel: 1, slotCount: 4 }, ...]
  learnedSpellsLimit?: number
  preparedSpellsLimit?: number
  cantripsLimit?: number
}
```

For single-class characters: read `compiledClass.spellcasting.spellLimits` at the character's
class level → slot counts directly, no lookup table needed.

For multiclass, 5e uses a **fusion table** (DMG p. 165) that is NOT derivable from individual
class tables — it requires knowing each class's "effective caster level" contribution (full, half,
or third caster). We detect this from the class's `spellLimits` shape:

- Full caster: `spellLimits` has 20 entries with level 1+ slots from level 1
- Half caster: first slots appear at level 2 (`spellLimits[0].slots` empty or level 1 has no slots)
- Third caster: first slots at level 3
- Pact magic: detected by `spellcasting.attributes` containing a custom magic name attribute; uses
  separate charge-based slot tracking (the `spellcasting.charges` field)

### `spellSlotTable.ts` — 5e multiclass fusion table only

`packages/shared/src/domains/engine/dnd5e2014/spellSlotTable.ts`

Only needed for multiclass fusion. Single-class reads directly from `spellLimits`.

```typescript
// Multiclass combined slot table — indexed by [effectiveCasterLevel][slotLevel]
export const DND5E2014_MULTICLASS_SLOT_TABLE: Record<number, Record<number, number>>
```

### `spellSlotResolver.ts`

`packages/shared/src/domains/engine/resolution/spellSlotResolver.ts`

```typescript
export function resolveSpellSlots(
  classes: Array<{ classId: string; level: number }>,
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem
): EngineSpellSlots
```

Algorithm:
1. For each class, look up `compiledClass.spellcasting`
2. If single spellcasting class: read `spellLimits` at class level → `fusionStrategy: 'SINGLE_CLASS'`
3. If multiple spellcasting classes: infer effective caster level from each class's `spellLimits`
   shape, sum, look up fusion table → `fusionStrategy: 'MULTICLASS_FUSED'`
4. If a class has pact magic (`spellcasting.charges` present): record separately as `pactMagic`
5. If no spellcasting: return empty `maxByLevel: {}`, `fusionStrategy: 'NONE'`

---

## Part 5 — Class Resource Tracking

### `resourceResolver.ts`

`packages/shared/src/domains/engine/resolution/resourceResolver.ts`

```typescript
export function resolveResources(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem
): EngineResource[]
```

Walks `snapshot.features` → for each feature, looks up `registry.features[feature.featureId]`.
Features that carry a `ChargeLimit` in their compiled form represent class resources.
Resolves `maxCount` using the `ChargeLimit`'s progression at the current class level.

The `RulesSystem` interface gains an optional method:
```typescript
resolveResourceMax?(chargeLimit: unknown, classLevel: number): number
```
Default implementation: read `ChargeLimit.perLevel[classLevel].value` or a fixed value.

---

## Part 6 — Prerequisite Evaluation

`packages/shared/src/domains/engine/prerequisiteEval.ts`

```typescript
export interface PrerequisiteResult {
  passed: boolean
  failedRequirements: Array<{ description: string; required: string; actual: string }>
}

// Entry prerequisite — validated by command handlers before acquisition
export function evaluateEntryPrerequisite(
  prerequisite: CompiledPrerequisite,
  engineOutput: EngineCharacterOutput
): PrerequisiteResult

// Ongoing restriction — seam for future use; always returns null in Phase 6.5
export function evaluateOngoingRestriction(
  restriction: unknown,
  engineOutput: EngineCharacterOutput
): null
```

`CompiledPrerequisite` is a new type in `packages/shared/src/domains/subjects/compilers/prerequisite.ts`:
```typescript
export type CompiledPrerequisite =
  | { kind: 'ABILITY_SCORE'; ability: string; min: number }
  | { kind: 'PROFICIENCY'; proficiencyKind: string; subjectId: string }
  | { kind: 'CLASS_LEVEL'; classId: string; min: number }
  | { kind: 'ANY_OF'; prerequisites: CompiledPrerequisite[] }
  | { kind: 'ALL_OF'; prerequisites: CompiledPrerequisite[] }
```

Command handlers call `evaluateEntryPrerequisite` with the current `EngineCharacterOutput`
before emitting `FeatChosenEvent` or `ClassLevelGainedEvent` (multiclass path).

---

## Part 7 — Character Lifecycle Events

`packages/shared/src/domains/character/events/`

### Event metadata envelope

```typescript
// packages/shared/src/domains/character/events/envelope.ts
export interface CharacterEventEnvelope {
  eventId: string          // UUID
  characterId: string
  occurredAt: string       // ISO8601
  actorId: string
  commandId: string
  schemaVersion: number    // migration-safe
}
```

### `ContentRef`

```typescript
// packages/shared/src/domains/character/contentRef.ts
export interface ContentRef {
  contentId: string
  contentVersionId?: string    // optional now; required once marketplace is active
  systemId: string
}
```

### Full event union

```typescript
// packages/shared/src/domains/character/events/index.ts
export type CharacterEvent =
  | CharacterCreatedEvent
  | RaceAssignedEvent
  | BackgroundAssignedEvent
  | AbilityScoresGeneratedEvent    // method + full roll history preserved
  | AbilityScoresReplacedEvent     // ASI, manual override
  | ClassLevelGainedEvent
  | HitPointsAppliedEvent
  | FeatureSelectionMadeEvent
  | FeatChosenEvent
  | SpellSelectionUpdatedEvent
  | EquipmentAcquiredEvent
  | EquipmentRemovedEvent
  | ItemEquippedEvent
  | ItemUnequippedEvent
```

### Key event shapes

```typescript
export interface AbilityScoresGeneratedEvent extends CharacterEventEnvelope {
  type: 'ABILITY_SCORES_GENERATED'
  method: 'STANDARD_ARRAY' | 'POINT_BUY' | 'MANUAL_ROLLED'
  rolls?: Array<{
    rollGroupId: string
    dice: number[]       // individual die faces, e.g. [4, 3, 6, 2]
    dropped: number[]    // dropped lowest
    total: number
  }>
  assignments: Record<string, number>   // abilityCode → final score
}

export interface ClassLevelGainedEvent extends CharacterEventEnvelope {
  type: 'CLASS_LEVEL_GAINED'
  classRef: ContentRef
  subclassRef?: ContentRef
  newLevel: number
  totalCharacterLevel: number
}

export interface HitPointsAppliedEvent extends CharacterEventEnvelope {
  type: 'HITPOINTS_APPLIED'
  classRef: ContentRef
  classLevel: number
  method: 'ROLLED' | 'AVERAGE' | 'MAXIMUM'
  roll?: number
  value: number          // final value with CON mod already included
}

export interface ItemEquippedEvent extends CharacterEventEnvelope {
  type: 'ITEM_EQUIPPED'
  instanceId: string
  equippedState: EquippedState
  previousEquippedState?: EquippedState
}
```

---

## Part 8 — Option / Choice Resolution

### `resolvePendingChoices`

`packages/shared/src/domains/engine/choiceResolver.ts`

Pure function, used by both read models and command handler validation (so the paths never diverge):

```typescript
export function resolvePendingChoices(
  buildState: CharacterBuildState,
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem
): PendingChoiceGroup[]

export interface PendingChoiceGroup {
  featureId: string
  acquisitionId: string        // which acquisition (matters for multiclass duplicates)
  choiceKey: string
  requiredCount: number
  selectedCount: number
  remainingCount: number
  allowedOptions: ContentRef[]   // filtered by prerequisites
  selectedOptions: ContentRef[]
  status: 'COMPLETE' | 'INCOMPLETE' | 'INVALID'
}
```

Choice resolution is **iterative over the active feature graph** — subclass activation may
introduce new pending choices. Recurse until no new unresolved choices appear.

### `SpellSelectionView` — derived, not persisted

```typescript
export interface SpellSelectionView {
  knownSpells: ContentRef[]
  maxKnown: number
  remainingCapacity: number
  allowedAdditions: ContentRef[]
  allowedReplacements: ContentRef[]
  sourceProvenance: Array<{ spellRef: ContentRef; grantedBy: string }>
}
```

### `CharacterDecisionsView` — API response shape

```typescript
export interface CharacterDecisionsView {
  pendingFeatureChoices: PendingChoiceGroup[]
  pendingSpellChoices: SpellSelectionView[]
  completedChoices: PendingChoiceGroup[]
  blockingIssues: Array<{ code: string; message: string; choiceKey?: string }>
  isComplete: boolean
}
```

---

## Part 9 — `CharacterBuildState`

`packages/shared/src/domains/character/buildState.ts`

Canonical persisted current build. Source of truth for editing. Input to snapshot builder.

```typescript
export interface CharacterBuildState {
  characterId: string
  systemId: string
  streamVersion: number          // optimistic concurrency — increments with each event

  name: string
  raceRef?: ContentRef
  backgroundRef?: ContentRef

  classes: Array<{
    classRef: ContentRef
    subclassRef?: ContentRef
    level: number
  }>

  abilityScores: Record<string, number>
  abilityGenerationMethod: 'STANDARD_ARRAY' | 'POINT_BUY' | 'MANUAL_ROLLED'

  hitpointsByLevel: Array<{
    classRef: ContentRef
    classLevel: number
    value: number
  }>

  featureSelections: Array<{
    featureId: string
    optionId: string
    atLevel: number
  }>

  featRefs: ContentRef[]
  spellRefs: ContentRef[]
  ownedEquipment: OwnedEquipmentInstance[]
}
```

**Three distinct read models — never conflate their responsibilities:**

| Model | Location | Purpose |
|---|---|---|
| `CharacterBuildState` | Persisted in DB | Canonical editing truth |
| `CharacterHistoryView` | Derived from event log | Audit / UI timeline |
| `CharacterBuildSnapshot` | Ephemeral | Engine input |
| `EngineCharacterOutput` | Ephemeral | Full resolved character sheet |

UI process flags (`rolling`, `applied`) must NOT live in `CharacterBuildState` or events —
they are frontend/session state only.

---

## Part 10 — Command Layer

### Command DTOs — `packages/schema/src/domains/character/commands/`

```
createCharacter.ts        — CreateCharacterCommand
assignAbilityScores.ts    — AssignAbilityScoresCommand
gainClassLevel.ts         — GainClassLevelCommand
applyHitPoints.ts         — ApplyHitPointsCommand
makeFeatureSelection.ts   — MakeFeatureSelectionCommand
chooseFeat.ts             — ChooseFeatCommand (includes prerequisite check)
updateSpellSelection.ts   — UpdateSpellSelectionCommand
acquireEquipment.ts       — AcquireEquipmentCommand
equipItem.ts              — EquipItemCommand
unequipItem.ts            — UnequipItemCommand
index.ts
```

### Command handlers — `packages/functions/src/services/character/commands/`

Handler contract:
```typescript
type CommandHandler<TCommand, TResult> = (
  command: TCommand,
  currentState: CharacterBuildState,
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem
) => Promise<{ events: CharacterEvent[]; newState: CharacterBuildState; result: TResult }>
```

Note: `registry` is passed to handlers (needed for prerequisite evaluation, spell selection
validation, equipment resolution).

### `CharacterLifecycleService` — `packages/functions/src/services/character/lifecycleService.ts`

1. Load `CharacterBuildState` + `streamVersion` from DB
2. Build `CharacterAssemblyRegistry` from DB (compiled content lookup)
3. Run command handler → validate → emit events
4. Optimistic concurrency check: compare `streamVersion` before write
5. Persist events to `character_events` table
6. Patch `CharacterBuildState` from events
7. Return updated state or version-conflict error

---

## Part 11 — Content Authoring → Character Consumption Boundary

```
Content Author
  → Authors Race/Class/Feat/Spell/Equipment (Phases 1–5)
  → Compiles → persisted as Compiled* in DB
  → (Future) published with contentVersionId

Character Owner
  → Issues command with ContentRef { contentId, contentVersionId? }
  → Command handler resolves compiled content from registry
  → Command handler checks entitlement (stub: always GRANTED for SRD)
  → Emits event with ContentRef
  → snapshotBuilder builds CharacterBuildSnapshot for runEngine
  → Engine is fully blind to ownership/entitlements
```

Entitlement stub — `packages/functions/src/services/character/contentAccess.ts`:
```typescript
export async function resolveContentAccess(
  userId: string,
  contentRef: ContentRef,
  db: Kysely<Database>
): Promise<'GRANTED' | 'DENIED' | 'REQUIRES_PURCHASE'>
// Phase 6.5: always returns 'GRANTED'
// Marketplace phase: checks entitlements, subscriptions, purchases
```

---

## DB Changes

### New table: `character_events`

```sql
create table character_events (
  event_id       uuid primary key default gen_random_uuid(),
  character_id   uuid not null references characters(id) on delete cascade,
  event_type     text not null,
  event_data     jsonb not null,
  schema_version int not null default 1,
  actor_id       uuid not null,
  command_id     uuid not null,
  occurred_at    timestamptz not null default now()
);
create index on character_events (character_id, occurred_at);
```

### Modify: `characters` table

```sql
alter table characters add column stream_version integer not null default 0;
```

### New Kysely repositories

- `packages/db/src/domains/subjects/repositories/characterEvent.ts` — append + list by character
- Update `packages/db/src/domains/subjects/repositories/character.ts` — include `streamVersion`

---

## Critical Files

### Engine kernel move (packages/functions → packages/shared)

| Old | New |
|---|---|
| `packages/functions/src/services/character/engine.ts` | `packages/shared/src/domains/engine/kernel.ts` |
| `packages/functions/src/services/character/resolution/grantApplicator.ts` | `packages/shared/src/domains/engine/resolution/grantApplicator.ts` |
| `packages/functions/src/services/character/resolution/modifierResolver.ts` | `packages/shared/src/domains/engine/resolution/modifierResolver.ts` |
| `packages/functions/src/services/character/resolution/derivedStatCalculator.ts` | `packages/shared/src/domains/engine/resolution/derivedStatCalculator.ts` |
| `packages/functions/src/services/character/resolution/index.ts` | `packages/shared/src/domains/engine/resolution/index.ts` |
| `packages/functions/src/services/character/types.ts` | `packages/shared/src/domains/engine/registry.ts` |
| `packages/functions/src/__tests__/engine.test.ts` | `packages/shared/src/__tests__/engine.test.ts` |

`packages/functions/src/services/character/types.ts` becomes a re-export shim pointing to shared.

### New files in `packages/shared`

```
src/domains/engine/
  kernel.ts                            — moved runEngine
  registry.ts                          — moved CharacterAssemblyRegistry (already created)
  snapshot.ts                          — CharacterBuildSnapshot, OwnedEquipmentInstance, EquippedState
  choiceResolver.ts                    — resolvePendingChoices, PendingChoiceGroup
  prerequisiteEval.ts                  — evaluateEntryPrerequisite, CompiledPrerequisite
  resolution/
    grantApplicator.ts                 — moved + import updated
    modifierResolver.ts                — moved + import updated
    derivedStatCalculator.ts           — moved + extended with armor-aware AC
    spellSlotResolver.ts               — NEW
    resourceResolver.ts                — NEW
    index.ts                           — moved + new exports added
  dnd5e2014/
    spellSlotTable.ts                  — NEW: 5e slot progression tables
  contracts/
    engineState.ts                     — extended: EngineSpellSlots, EngineResource, EngineItemContribution
src/domains/character/
  contentRef.ts                        — ContentRef
  buildState.ts                        — CharacterBuildState, OwnedEquipmentInstance
  events/
    envelope.ts                        — CharacterEventEnvelope
    index.ts                           — CharacterEvent union + all event types
src/domains/subjects/compilers/
  prerequisite.ts                      — CompiledPrerequisite
```

### New files in `packages/schema`

```
src/domains/character/commands/
  createCharacter.ts
  assignAbilityScores.ts
  gainClassLevel.ts
  applyHitPoints.ts
  makeFeatureSelection.ts
  chooseFeat.ts
  updateSpellSelection.ts
  acquireEquipment.ts
  equipItem.ts
  unequipItem.ts
  index.ts
```

### New files in `packages/functions`

```
src/services/character/
  commands/
    createCharacter.ts
    assignAbilityScores.ts
    gainClassLevel.ts
    applyHitPoints.ts
    makeFeatureSelection.ts
    chooseFeat.ts
    updateSpellSelection.ts
    acquireEquipment.ts
    equipItem.ts
    unequipItem.ts
    index.ts
  lifecycleService.ts
  snapshotBuilder.ts
  contentAccess.ts
```

### New files in `packages/db`

```
src/domains/subjects/tables/character_events.sql
src/domains/subjects/repositories/characterEvent.ts
```

---

## Exit Criteria

- [x] `npx tsc -p packages/shared/tsconfig.build.json --noEmit` — clean
- [x] `npx tsc -p packages/functions/tsconfig.build.json --noEmit` — clean
- [x] `npx tsc -p packages/schema/tsconfig.build.json --noEmit` — clean
- [x] `npx tsc -p packages/db/tsconfig.build.json --noEmit` — clean
- [x] `npx vitest run packages/shared/src/__tests__/engine.test.ts` — 40 tests pass (migrated + 4 new armor AC tests)
- [x] Engine kernel moved: `packages/functions/resolution/` → `packages/shared/src/domains/engine/resolution/`
- [x] `CharacterAssemblyRegistry` moved: `packages/functions/types.ts` → `packages/shared/src/domains/engine/registry.ts`
- [x] `CharacterBuildSnapshot` + `EquippedState` + `OwnedEquipmentInstance` + `ContentRef` in `snapshot.ts`
- [x] Armor-aware AC: plate (HEAVY, 18 no DEX), chain mail (MEDIUM, cap +2), leather (LIGHT, full DEX), shield (+2)
- [x] `EngineCharacterOutput` extended: `spellSlots`, `resources`, `activeItemContributions`
- [x] `spellSlotResolver.ts`: single-class reads `spellLimits` directly; multiclass fusion table; pact magic separate
- [x] `resourceResolver.ts`: resolves `CompiledCharge` at class level (FIXED_AMOUNT static, PER_LEVEL lookup, CLASS_LEVEL multiplier)
- [x] `choiceResolver.ts`: `PendingChoiceGroup`, `CharacterDecisionsView` — foundation stub, full implementation pending compiled feature option shapes
- [x] `prerequisiteEval.ts`: `evaluateEntryPrerequisite` (ABILITY_SCORE implemented; CLASS_LEVEL, PROFICIENCY, FEAT seams in place); `evaluateOngoingRestriction` always null
- [x] `CharacterEvent` union (14 event types) with full dice history on `AbilityScoresGeneratedEvent`
- [x] `CharacterBuildState` with `streamVersion` for optimistic concurrency
- [x] 10 command DTOs (Zod) in `packages/schema/src/domains/character/commands/`
- [x] 10 command handlers in `packages/functions/src/services/character/commands/`
- [x] `snapshotBuilder.ts` — assembles `CharacterBuildSnapshot` from state + registry
- [x] `contentAccess.ts` — entitlement stub (always GRANTED)
- [x] `character_events.sql` table + `CharacterEventRepository`
- [x] `REBUILD_PLAN.md` Phase 6.5 status updated

### Deferred to follow-up

- `CharacterLifecycleService` (orchestrate load → command → persist → patch) — shell not yet wired to DB
- `CharacterHistoryView` read model — event log → UI timeline projection
- `SpellSelectionView` — max known / remaining capacity derivation
- `resolvePendingChoices` full implementation — requires compiled feature option shapes to be finalized
- `stream_version` column migration on `characters` table — needs Supabase migration run
- `CompiledPrerequisite` on `CompiledFeat` — feat compiler not yet extended (seam present in `prerequisiteEval.ts`)
- End-to-end integration test (event round-trip, lifecycle service, concurrency) — gated on real DB data
- `packages/db` types regeneration after `character_events` migration runs on Supabase

---

## Out of Scope (Phase 7+)

- API transport routes (Phase 7 builds on this)
- Damage rolls, attack rolls, combat simulation
- Condition tracking
- Spell slot / resource depletion (play-state — separate mutable table)
- Content versioning enforcement (shape present; implementation deferred)
- Marketplace entitlement enforcement (stub in place)
- Campaign events, encounter tracking
- Collaborative editing / real-time sync
- Multi-system support beyond 5e 2014 (architecture supports it)
