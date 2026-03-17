# Phase 6: Character Engine

## Objective

Implement a deterministic, pure character engine that resolves compiled character intent into
derived character state. The engine is system-agnostic by design. D&D 5e 2014 SRD is the first
concrete implementation, not the engine itself.

## Status: Complete (Kernel Foundation)

All exit criteria met. 36 engine tests pass alongside existing test suite (43 total).

**Note:** Phase 6 delivered the pure mechanical engine kernel only. Full character management
(equipped-item AC, spell slot maximums, class resource maximums, prerequisite evaluation,
character lifecycle events with history) is covered in **Phase 6.5**.
See `PHASE_6_5_ENGINE_SUBPLAN.md`.

---

## System-Agnostic Architecture

The engine operates against a `RulesSystem` interface defined in:

```
packages/shared/src/domains/engine/contracts/rulesSystem.ts
```

The interface provides:
- `proficiencyBonus(level)` — proficiency bonus for a given total character level
- `abilityModifier(score)` — ability score modifier
- `stackingConfig(domain, kind)` — stacking rule for a given modifier domain+kind
- `grantApplicationOrder` — order in which grant kinds are applied within a feature
- `featureSourceOrder` — order in which feature sources are processed

The D&D 5e 2014 SRD implementation is exported as `dnd5e2014RulesSystem` from:

```
packages/shared/src/domains/engine/dnd5e2014/index.ts
```

Both are re-exported from `packages/shared/src/barrels/core/index.ts` and available
as `@artificer-toolkit/shared` imports.

---

## Rule Ordering Document

`packages/shared/src/domains/engine/dnd5e2014/RULE_ORDER.md`

Defines the correctness contract for the `dnd5e2014` implementation:
- Feature acquisition order (RACE → SUBRACE → BACKGROUND → CLASS → SUBCLASS → FEAT → EQUIPMENT)
- Grant application order (PROFICIENCY_GRANT → SENSE_GRANT → MODIFIER_GRANT → FEAT_GRANT → SPELL_GRANT)
- Modifier stacking rules per modifier kind
- Derived stat calculation precedence (ability scores → modifiers → PB → saves → skills → HP → AC → initiative → spell DC)

---

## Implementation

### New files in `packages/shared/src/domains/engine/`

```
contracts/
  rulesSystem.ts      — RulesSystem interface, ModifierStackingConfig
  engineState.ts      — EngineProficiency, EngineSense, EngineDerivedStats, EngineCharacterOutput
  index.ts
dnd5e2014/
  RULE_ORDER.md       — correctness contract
  proficiencyBonus.ts — floor((level - 1) / 4) + 2
  modifierStacking.ts — BONUS → additive, SET_VALUE → last, ADVANTAGE → boolean, etc.
  featureOrder.ts     — DND5E2014_FEATURE_SOURCE_ORDER, DND5E2014_GRANT_APPLICATION_ORDER
  index.ts            — dnd5e2014RulesSystem: RulesSystem
```

### Modified: `packages/shared/src/barrels/core/index.ts`

Added exports for engine contracts and dnd5e2014 implementation.

### Modified: `packages/functions/src/services/character/types.ts`

`CharacterAssemblyRegistry` expanded to include `classes`, `feats`, `equipment`, `spells`
records. Registry is caller-populated — engine and assembly functions are pure readers.

### New files in `packages/functions/src/services/character/`

```
engine.ts                     — runEngine(input, registry, rules): EngineCharacterOutput
resolution/
  grantApplicator.ts          — applyGrants(): sorts features by source order, accumulates proficiencies/senses/modifiers
  modifierResolver.ts         — resolveModifiers(): collapses modifier entries per stacking rule
  derivedStatCalculator.ts    — calculateDerivedStats(): HP, AC, saves, skills, initiative, spell DC
  index.ts
```

### New test file

`packages/functions/src/__tests__/engine.test.ts` — 36 tests covering:
- PB table (levels 1–20)
- Ability modifier table
- Modifier stacking (additive, last, boolean)
- Full pipeline: level 3 Fighter with STR/CON proficiencies and Athletics skill
- Determinism (identical inputs → identical output)

---

## Exit Criteria Status

- [x] Rule-ordering document exists before implementation
- [x] `RulesSystem` is defined
- [x] `dnd5e2014RulesSystem` conforms to `RulesSystem`
- [x] Engine produces identical derived stats from identical inputs
- [x] Engine is pure (no persistence calls, no side effects)
- [x] Rule-ordering document referenced in engine implementation
- [x] `packages/shared` typechecks clean
- [x] `packages/functions` typechecks clean
- [x] All 43 tests pass

---

## Moved to Phase 6.5

The following were initially deferred but belong to full character management, not Phase 7+.
They are now covered in `PHASE_6_5_ENGINE_SUBPLAN.md`:

- AC from equipped armor and equipped item tracking
- Spell slot maximums (including multiclass fusion)
- Class resource maximums (Rage, Ki, Channel Divinity, etc.)
- Feat/multiclass prerequisite enforcement
- Character lifecycle events (roll history, level-up history, audit trail)
- `CharacterBuildState` (canonical persisted current build)
- Choice/option resolution (pending choices, cascading feature selections)
- `runEngine` kernel moved from `packages/functions` → `packages/shared`

## Out of Scope (Phase 7+)

- Damage / attack roll simulation (effects chain)
- Condition tracking
- Spell slot / resource depletion (play-state)
- Per-scope ENHANCEMENT bonus capping
- REST route for `/character/:id/derived-stats` (Phase 7 API transport)
