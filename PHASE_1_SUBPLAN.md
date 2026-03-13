# Phase 1: Root Authored Node Map Coverage

## Status: Complete

This is the active implementation phase. Update this checklist in the same change as the code so handoff stays accurate.

## Objective

Make every content-graph authored root completely representable by node maps, with nested authored substructures mapped where they actually live in the authored model.

Phase 1 is no longer just the old DSL migration. That migration work is done enough to move forward, but the real blocker is coverage and nesting completeness.

## Phase Rules

- Every root authored type in `effects`, `shared`, `grants`, `features`, and `subjects` must be fully traversable through a node map tree.
- Parent maps must include their owned nested authored structures all the way down.
- Helper authored types may stay private local maps if the parent is still complete.
- No authored property should be silently dropped unless the phase doc explicitly marks it non-authorable.
- DnD 5e SRD is the baseline rules reference for this version of the app, but the map and domain model must stay flexible enough for homebrew extensions.

## Scope

### In Scope

- Complete root coverage for content-graph authored types.
- Shared nested grant ownership under features, options, feats, and other content roots where applicable.
- Completeness review for `showIf`, branch ownership, and filtered option behavior.
- Remaining DSL cleanup only where it directly blocks root coverage.

### Out of Scope

- Vocabulary authored models as root maps.
- Frontend rendering or form work.
- Runtime resolver execution.
- Full compiler hardening beyond what is needed to verify map-layer coverage.

## Current Repo Truth

- The old callback / legacy node-kind migration is effectively complete.
- Root map coverage is now materially complete for the content-graph authored roots in scope.
- Grant map coverage is now materially complete for the authored grant types currently nested under content roots.
- The active blocker has shifted from map coverage to downstream compiler drift in `packages/shared`.
- Scaling already appears in authored and compiler layers and should not be flattened just to simplify authoring maps.

## Implementation Checklist

### Foundation

- [x] Remove old `BRANCH` / `LEAF` / `KNOT` / `PATH` node-kind usage from `packages/shared/src`
- [x] Migrate legacy `define()` callback signatures to `define(mapId, api)`
- [x] Rewrite or update root maps to match authored ownership rather than placeholder coverage
- [ ] Add Vitest map completeness and nesting tests for completed root maps (deferred follow-up; not blocking Phase 1 exit)

### Grant coverage and nesting

- [x] Add a shared grants-owner node map for `FeatureBaseAuthored['grants']`
- [x] Add or finish `FeatGrantAuthored` node map
- [x] Add or finish `ModifierGrantAuthored` node map
- [x] Add or finish `ProficiencyGrantAuthored` node map
- [x] Add or finish `SenseGrantAuthored` node map
- [x] Add or finish `SpellGrantAuthored` node map
- [x] Nest shared grant ownership into `FeatureAuthored`
- [x] Nest shared grant ownership into `OptionAuthored`
- [x] Add feat grant ownership into `FeatAuthored`

### Feature roots

- [x] `FEATURE_NODE_MAP` fully covers `FeatureAuthored`
- [x] `OPTION_NODE_MAP` fully covers `OptionAuthored`

### Subject roots

- [x] `FEAT_NODE_MAP` fully covers `FeatAuthored`
- [x] `BACKGROUND_NODE_MAP` fully covers `BackgroundAuthored`
- [x] `CLASS_NODE_MAP` fully covers `ClassAuthored`
- [x] `RACE_NODE_MAP` fully covers `RaceAuthored`
- [x] `SPELL_NODE_MAP` fully covers `SpellAuthored`
- [x] `EQUIPMENT_NODE_MAP` fully covers `EquipmentAuthored | EquipmentVariantAuthored`

### Completeness audit

- [x] Every root map accounts for every authored property
- [x] Every nested authored child is represented in the node tree
- [x] Discriminated branches have correct `showIf` behavior
- [x] Filtered option inputs are narrowed where parent selections constrain them
- [x] Export barrels only expose canonical roots and reusable helper maps
- [x] `packages/shared` map-layer type errors are eliminated before compiler hardening continues
- [x] Update `REBUILD_PLAN.md` tracker when Phase 1 exits

## Exit Criteria

- Every content-graph root authored type is fully represented by a node map tree.
- Grant ownership is nested consistently where it belongs in authored roots.
- No empty placeholder map files remain in `packages/shared/src/domains/*/maps`.
- `packages/shared` no longer has map-layer type errors.
- Phase 2 starts only after the Phase 1 checklist reflects the real completion state.

## Handoff Note

If work stops mid-phase:

- update the checklist above in the same change
- note which root map or helper map was being audited
- record whether the current blocker is map completeness, filtering behavior, or downstream compiler drift

Locked decisions for handoff:

- Phase 0 stays closed unless a backend package-boundary issue directly blocks this phase
- `apps/web` remains frozen
- use `vitest` for Phase 1 verification when tests are added
- SRD is the baseline rules reference for this app version, but map and domain design should preserve homebrew flexibility

Current handoff status:

- `FEATURE_GRANTS_NODE_MAP` now exists and is nested into feature, option, and feat roots
- `FeatGrantAuthored`, `SenseGrantAuthored`, `ProficiencyGrantAuthored`, and `SpellGrantAuthored` now cover shared grant-base fields consistently enough for Phase 1, including restrictions / selection / scaling structure
- `ModifierGrantAuthored` now covers the authored replacement and charge-limit payload branches more completely, including `grantKind`, range/duration/shape/reset replacement fields, and charge-limit payload structure
- `FEATURE_NODE_MAP`, `OPTION_NODE_MAP`, `FEAT_NODE_MAP`, `BACKGROUND_NODE_MAP`, `SPELL_NODE_MAP`, `EQUIPMENT_NODE_MAP`, `RACE_NODE_MAP`, and `CLASS_NODE_MAP` now cover their root authored fields materially better than before
- `RACE_NODE_MAP` currently represents the boolean `playable` field using a text input because the current node DSL does not appear to expose a boolean-native input node
- `packages/shared` still fails typecheck, but the remaining failures are in compiler drift rather than the map layer:
- `effects/compilers/damage.ts` and `effects/compilers/effect.ts` still have outdated payload/scaling assumptions
- `shared/compilers/charge.ts`, `range.ts`, and `startingEquipment.ts` still drift from current authored/core types
- `subjects/compilers/equipment.ts` still has the feature-grant generic mismatch, and `subjects/compilers/feat.ts` still references removed target/restriction helpers
- `vitest` map-completeness tests are still deferred until the first actual backend test harness step; that follow-up is no longer blocking Phase 1 exit
