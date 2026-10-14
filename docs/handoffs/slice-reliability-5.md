# Slice workbook: RELIABILITY-5 (speed and sense modifiers carry their length unit)

**Status:** DONE (T1 merged `a11b9d368`; T2 continues in [slice-reliability-5-t2.md](slice-reliability-5-t2.md))
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

1. **Modifier lengths (RELIABILITY-5.1).** Authored `SPEED` and `SENSE_RANGE` modifier values (`BONUS`, `PENALTY`, `SET_VALUE`) are bare numbers added in the base's unit today, so +30 on an 18 m sense gives 48 m, and `characterMovementAndSenses` defaults a base-less `SET_VALUE` speed to `FEET` and 0. Make these values lengths with a unit (`{ amount, unit }`, the shape D111 uses for sense ranges) and convert through the one shared conversion in `packages/shared/src/domains/core/measurement.ts` (`lengthMeasurementInFeet`, `feetInLengthUnit`), so +30 ft on an 18 m sense or speed adds 30 ft. A base-less `SET_VALUE` speed takes its unit from the modifier, with no default unit and no default zero. Migrate the SRD corpus and the authoring node map (`packages/shared/src/domains/grants/maps/modifier.ts`) in the same change; pre-launch, no compatibility shim (AGENTS.md).
2. **Malformed speeds (RELIABILITY-5.2).** A malformed or unrecognised authored speed is refused at publish and is an invariant failure at read. Today `packages/rules-runtime/src/encounterHolderDefense.ts` (around lines 21-53) and `packages/rules-runtime/src/walkingSpeed.ts` skip entries they cannot read, so bad data can show as a lower speed or defence. Remove the skips; publication validation owns the refusal.

Bounds: lengths use `AUTHORED_LENGTH_AMOUNT_MAX` as D111 does. Contract changes go in `packages/schema/src/grants/modifier.ts`; if the shape cannot express an SRD case, escalate before changing it.

Read first: D100, D108, D111 in `docs/handoffs/phase-08-2-decisions.md`; `docs/architecture/rules-runtime.md`; `packages/rules-runtime/src/systems/dnd5e/characterMovementAndSenses.ts`; `packages/rules-runtime/src/__tests__/characterSenseRange.test.ts`; `packages/shared/src/__tests__/sense-range-node-map.test.ts`.

## Closes

- ACs RELIABILITY-5.1 and RELIABILITY-5.2.

## File scope

`packages/schema` (modifier value contract), `packages/shared` (grant core and node maps), `packages/rules-runtime` (movement, senses, holder defence, walking speed), `packages/authoring` publication validation, `packages/source-data` SRD migration, and `apps/apis/convex` only where it validates or stores the modifier. The main session resets and reseeds local Convex after merge; do not reset it yourself.

## Red-first checklist

1. +30 ft `BONUS` on an 18 m sense and on an 18 m speed yields 18 m + 30 ft through the shared conversion (fails before the fix).
2. `PENALTY` and `SET_VALUE` in a different unit from the base convert the same way.
3. A base-less `SET_VALUE` speed carries the modifier's unit and amount; no `FEET`/0 default remains.
4. Publication refuses a modifier length with no unit, an unknown unit or an out-of-bounds amount.
5. Publication refuses a malformed or unrecognised speed; reading one at encounter time throws an invariant failure in `encounterHolderDefense` and `walkingSpeed` instead of skipping it.
6. The SRD corpus and node map parse in the new shape (source-data and node-map tests), and the SRD audit stays green after reseed.
7. Journey: an authored speed and sense bonus in feet on a metric Character shows the converted value on the Sheet read model and the Scene token.

## Status log

- 2026-10-14: workbook written; session started.
- 2026-10-14: red logs captured under `local-validation/reliability-5/` (`red-packages.log` 39 failures, `red-source-data.log` 1, `red-apis.log` Spell publication red; the Creature publication tests were blocked by a stale `dist` in the worktree, a baseline environment issue).
- 2026-10-14: implementation: modifier payload is `authoredLengthSchema`; feet contributions converted into the base unit; base-less `SET_VALUE` speed takes the modifier's unit; `walkingSpeed` and `encounterHolderDefense` throw instead of skipping; node map and SRD producers migrated. Decision D112 and the rules-runtime guide updated.
- Premise changes: `walkingSpeed.test.ts` (skip became throw), `grant-facet-schema-parsing.test.ts` (SPEED and SENSE_RANGE payloads now `{ amount, unit }`), `activeGrantListings.test.ts` (SPEED `SET_VALUE` payloads now lengths).
- Deviations: the length units have no metric unit, so YARDS stands in for "metric" (18 m); the Scene token is proven through `resolveCharacterRecordStats` (the feet the room stores and `turnMovement` reads), not a live-room journey; the Creature speed refusal at publication was already enforced at baseline by `speedDtoSchema`, so that case has no genuine red.

- 2026-10-14: green: `green-packages-all.log` (233 files, 2187 tests across rules-runtime, schema, shared, source-data and the other packages), `green-source-data.log`, `green-apis-content.log` (40 files, 226 tests), `green-apis-encounters.log`, `green-apis-commandBoundary.log`; `tsc-convex.log` exit 0; `turbo-typecheck.log` exit 0 (13 tasks); `codegen.log` exit 0 (local push against the existing local Convex backend). The worktree needed `dist` rebuilds of shared, schema, packages and emails (baseline environment, not slice changes). Base had not moved (9ada1065e), so no merge was needed. No Convex reset or reseed was run; the SRD audit after reseed is for the main session.

## Review fix round (2026-10-14)

Frozen list from the main-session review. Base merged first (`codex/phase-08-2-convex-cutover` at `826584fe6`).

- **H1** Character record stats take the System speed definitions as the vocabulary (`registry.system.speeds`), not the Character's own speeds, so a base-less `SET_VALUE` speed (a feature granting Fly) saves and reconciles.
- **H2** `characterMovementAndSenses` floors a Character speed at 0, as `withActiveGrantSpeeds` does for a Creature, so `speedDtoSchema` never sees a negative amount.
- **M1** `encounterHolderState` takes the System `speedDefinitions` and refuses an id outside them; its test now uses the real walking speed id, with a separate case for the unknown id. The worker passes `system.speeds` from the `INPUTS` capture and persistence from `requireSystem`.
- **M2 display rounding rule:** one shared rule in `packages/shared/src/domains/core/measurement.ts`, `roundLengthForDisplay`: round to three decimals and drop trailing zeros, the precision of the web `Intl.NumberFormat('en-US')` number formatter, so a converted `13.333333333333334 yards` shows as `13.333 yards`. `formatLengthMeasurement` builds the label every display site shares. Stored and computed amounts are never rounded.
- **M3** No metric unit was added; proofs use FEET, YARDS and MILES.
- **M4** D112 rewritten (Proposed — awaiting main-session adoption), with the removed value sources and the invariants as coded.
- **M5 stored shapes that changed** (the main session resets and reseeds): authored `SPEED` and `SENSE_RANGE` modifier payloads in published and draft subjects (SRD Monk, Longstrider, Ray of Frost, Fly, Caltrops, the heavy armor builder); `apps/apis/convex/content/srdManifest.generated.ts`; compiled modifier grants copied into persisted `activeRuleEffects` definitions; stored homebrew drafts and published subjects with bare-number payloads. Character play-state speeds stay in feet. Nothing in this fix round changed a stored shape.
- **SENSE_RANGE `SET_VALUE`:** refused at publication (the schema already says "not supported yet"; the SRD has none), and removed from the types' allowed kinds for the domain, rather than implemented. No silent no-op remains.
- **Escalated / reported, not changed:** the persisted Character `MOVEMENT` adjustment (`movementAdjustmentDtoSchema`, `field: 'SPEED_OVERRIDE'`) is a bare non-negative integer in the speed's own unit, so the `?? 'FEET'` / `?? 0` defaults in `characterMovementRuleFacts.ts` and `sheetPanel.ts` stay: they stand in for a Character that holds no base for that speed, which only an override can create. Changing it to a typed length is a persisted-contract change for the main session to decide.

- **LOW items:** the single-use helpers were inlined, the dead `Math.max` removed from `walkingSpeed.ts`, `scalarSign` reads the length domain through `isLengthModifierDomain`, the SET_VALUE speed fold is the one `widestLengthByKey` in `modifierLength.ts`, the web modifier row label and metadata show the unit, the impossible SENSE_RANGE PENALTY node-map case is gone, bare `toThrow()` calls carry messages, and the journey asserts the Scene token's sense range.
- Red evidence (before the production changes, `red-fix-packages.log`): 7 failed, 47 passed across the six package files: `shows a conversion that does not divide evenly rounded to three decimals`, `keeps the Character saveable and stores the granted speed in feet` (H1: `Speed … is not in the System speed vocabulary.`), `leaves the Character a speed of zero rather than a negative one` (H2: ZodError `too_small`), `never lets a penalty take a speed below zero`, `fails the read on a Creature speed that is not a typed length` (M1: unknown id resolved instead of rejecting), `rounds a converted length to three decimals…` and `offers a sense range only the modifier kinds the rules apply`. Red web run (`red-fix-web.log`, with `collectionPresentation.ts` reverted to base): 3 failed, 15 passed in `authoringNavigation.validation.test.ts` (the two row labels and the metadata case).
- Green (`green-fix-*.log`, exits in `green-fix.exits`): packages 228 files / 2171 tests, worker 34 files / 330 tests (including the `prepareNativeLiveMovementTarget` callers), web `src/forms` 31 of 32 files passed. The one web failure, `authoringNodeDefaultInventory.test.ts` (`invocation.check`, `check.dc`, `actorRelationshipModule.dc` have no default factory), is outside this slice: it comes from the ATTACK-18 slice D check map (`packages/shared/src/domains/effects/maps/check.ts`, e876a5939) already on the base, which this slice does not touch. Reported to the main session.
- Failures outside this slice, both reproducing without my changes:
  - `apps/web/src/domains/campaigns/vtt/vttSceneRenderer.model.test.ts(206,39)` and `(233,46)`, TS2345: `{ origin; shape: SpatialAreaShape; tokens; casterTokenId }` is not assignable to the `spatialTokensInsideArea` parameter (`{ shape: SpatialPointAreaShape } | { shape: SpatialDirectedAreaShape; casterTokenId: string }`). The test file is byte-identical at `5489f675c` (merge-base), the base tip `1d5a68738` and here; `packages/shared/src/domains/vtt/spatial.ts` is identical to the merge-base here, and the base tip carries `99ecf2a37` (SPELLS-13: `spatialTokensInsideArea` takes `SpatialAreaShape`), which this branch has not merged. It reproduces at the merge-base and is fixed on the base tip, so it clears with the next base merge. Read with `git show`/`git diff`, nothing checked out.
  - `authoringNodeDefaultInventory.test.ts`: no `checkDc`/`check` default factory exists under `apps/web/src/forms` at this branch or the base tip.
- Post-merge of the base tip `1d5a68738` (merge `96e5c5c33`, clean), logs `m-*.log`, exits in `merged.exits`: builds (shared, schema, rules-runtime, encounter-persistence) 0; packages 230 files / 2180 tests green; worker 34 files / 330 tests green; web `src/forms` + `src/domains/campaigns/vtt` 56 of 57 files (only `authoringNodeDefaultInventory`, the base failure above); apis (publication with exact messages, commandBoundary, basicActions, basicActionRestrictions, activeGrantListings, sheet, panels) 7 files / 36 tests green. `turbo typecheck typecheck:app typecheck:tests typecheck:stories --continue --filter=[1d5a68738]` exit 0 (20 of 20 tasks, so the earlier `vttSceneRenderer.model.test.ts` TS2345 is gone with the base merge); `apis typecheck:convex` exit 0. Codegen skipped, the main session runs it at merge.
- Publication refusal messages: the Spell refusal is a JSON dump of every modifier-grant union branch, so `modifierLengthPublication.test.ts` asserts the exact issue message of the broken length field (unit option list, `Too big … <=1000000`, `Too small … >=0`) taken from the real error text, not a regex.
- The first `build-fix-rules-runtime` run failed typecheck (`CharacterRuleMovementSpeed.unit` was the wide measurement unit); fixed to `LengthUnitCode` in `characterSheetRuleProjection.ts`, rebuilt and typechecked in `verify-fix.exits`.

## Proposed ledger edits (filled by the slice session)

- RELIABILITY-5.2 (malformed speeds refused at publish and failing at read): closed.
- RELIABILITY-5.1 (modifier lengths): delivered except the Character `MOVEMENT` `SPEED_OVERRIDE`, which stays a bare number until RELIABILITY-5.T2 types it as a length and removes the `?? 'FEET'` / `?? 0` defaults (comments in `characterMovementRuleFacts.ts` and `sheetPanel.ts` point there). Doc evidence: D112 (Proposed) and `docs/architecture/rules-runtime.md`.
- Follow-up for the main session after merge: reseed the local Convex backend (the SRD corpus changed shape) and rerun the SRD audit (checklist item 6, last clause).
- Open limit recorded in D112: `LENGTH_UNIT_CODES` has no metric unit, so an "18 m" authored length cannot be expressed yet. Register a slice to add one if metric authoring is wanted.
