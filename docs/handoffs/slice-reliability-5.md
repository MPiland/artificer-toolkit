# Slice workbook: RELIABILITY-5 (speed and sense modifiers carry their length unit)

**Status:** OPEN (started 2026-10-14)
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

## Proposed ledger edits (filled by the slice session)
