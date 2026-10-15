# Slice workbook: RELIABILITY-4 closeout (SQUARES Scene journey; default distance per cell)

**Status:** DONE (merged `be2a6d771`; closed by the main session 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

RELIABILITY-4.1 is DONE in code: a SQUARES grid measures each square as the System's 5 ft base square and its `distancePerCell` is always 1. Two things remain.

1. **Journey gap.** No app test drives an Encounter read on a SQUARES Scene. Add one convex-test or Session Worker journey that reads cleaving facts, a movement reaction contact and combat perception on a SQUARES Scene and gets correct lengths (for example a 5 ft reach contact one square away, a 10 ft reach two squares away, a 60 ft darkvision range in squares). Use real SRD content and the existing room fixtures; fake only platform and data.
2. **RELIABILITY-4.2.** A new Scene grid's default distance per cell is the System's base square in the chosen unit: 5 ft, 1.524 m, 1 square, from `feetInSceneUnit(SYSTEM_BASE_SQUARE_FEET, unit)` using `SYSTEM_BASE_SQUARE_FEET` and `FEET_PER_SCENE_UNIT`. Switching the unit converts it. Today `CampaignScenePreparation` seeds `SYSTEM_BASE_SQUARE_FEET` for FEET and METERS, so a Meters grid starts at 5 m per cell. Remove the SQUARES special case.

Read first: the RELIABILITY-4 ledger entry and its notes, D50 item 11 in `docs/handoffs/phase-08-2-decisions.md`, `packages/shared/src/__tests__/length-measurement.test.ts`.

## Closes

- RELIABILITY-4.2; the RELIABILITY-4 journey (then RELIABILITY-4 is DONE).

## File scope

New journey test file(s) under `apps/apis/convex/encounters` or `apps/session-worker/test`; `CampaignScenePreparation*` and its tests in `apps/web`; a shared length helper only if `feetInSceneUnit` is missing. Out of scope: the action drawer and stage overlays (parallel VTT session), basic actions (parallel ATTACK-18 slice E session).

## Red-first checklist

1. The SQUARES journey: run it against the pre-4.1 measurement (or a mutation that restores the throw) and keep the red log; green on the current tree. If it passes trivially, say why it would catch a regression.
2. A new Meters grid defaults to 1.524 m per cell (red today: 5).
3. Switching the unit converts the default (FEET 5 → METERS 1.524 → SQUARES 1, and back).
4. An author-edited distance per cell is not overwritten by a unit switch, unless the existing behavior already converts it; record which rule holds and why.

## Status log

- 2026-10-13: workbook written; session started.
- 2026-10-13: slice session. All four checklist items proved; branch committed.
  1. **SQUARES journey** (`apps/session-worker/test/nativeRoomSquaresScene.test.ts`, 12 tests). Each case runs the same Scene as a FEET grid (5 ft per cell) and a SQUARES grid (1 per cell) through the real native room, so identical results are the oracle. Cleaving facts: a 20 ft reach covers the Wolves two and three squares away, a 10 ft reach only the one two squares away. Movement reaction contacts: the reactor the mover leaves first is offered first. Combat perception: a Fighter with Darkvision (new `characterDarkvision` option on `movementRoom`) and a reaction Bite that must see its target, in an `ORDINARY_DARKNESS` Scene of 50 px squares: a 50 ft reach (ten squares) offers the reaction, an 80 ft reach (sixteen squares) is beyond the 60 ft (twelve squares) Darkvision and offers none, and without Darkvision nothing is seen. Red: `journey-red.log`, from a temporary `throw` for SQUARES in `feetInSceneUnit` (shared rebuilt, run, reverted, shared rebuilt); green: `journey-run3.log` on the current tree. `sceneGrid` is a new option on `movementRoom` and `actionRoom`.
  2. **Meters default** (web). Red `web-red-true.log` (old unit-switch logic: 5 stays 5 in Meters); green `web-run2.log`: a new Meters grid starts at 1.524 and saves `distancePerCell: 1.524`.
  3. **Unit switch converts** (web). FEET 5 → METERS 1.524 → SQUARES 1 → METERS 1.524 → FEET 5, in the same test.
  4. **Edited value rule: convert, never reset.** Switching from FEET or METERS converts the typed distance to the new unit (10 ft → 3.048 m → 10 ft). Switching to SQUARES forces 1, because the schema requires `distancePerCell: 1` there and the input is disabled; leaving SQUARES gives the base square (5 ft or 1.524 m), since the 1 is not an author-edited value. An edit made in FEET, then SQUARES, then back to FEET therefore returns 5, not the edit.
- Shared fix (red first, `shared-red.log` → `shared-green.log`): `feetInSceneUnit` divided by `1/0.3048`, which gave 1.5240000000000002 ft→m for 5 ft. It now multiplies by the new `METERS_PER_FOOT`, and `convertSceneDistance(amount, from, to)` converts between units with exact whole-foot round trips (5 ↔ 1.524, 10 ↔ 3.048). No rounding needed. The Distance per cell input shows up to 3 decimals.
- The `SQUARES` branch at save time stays only as a type narrowing: the schema's SQUARES grid is a separate variant with a literal `distancePerCell: 1`.
- Environment note: this worktree has no `dist` of its own, so web and Worker tests fell back to a stale resolution (`SYSTEM_BASE_SQUARE_FEET` came back `undefined` and the existing Squares test failed at HEAD: `web-red.log`, `web-baseline-squares.log`). Building `packages/shared`, `schema`, `rules-runtime` and `encounter-persistence` in the worktree fixed it; those are not tracked.
- Validation: shared `length-measurement.test.ts`; web `CampaignScenePreparation.test.tsx` (8); Worker `nativeRoomSquaresScene.test.ts` (12); `turbo run typecheck --filter="[HEAD]"` (12 tasks, includes shared, web, session-worker). Storybook runs not possible in a worktree: none touched.

## Proposed ledger edits (filled by the slice session)

- RELIABILITY-4.2: DONE. Evidence: `CampaignScenePreparation.test.tsx` (Meters 1.524 default and save, unit-switch conversion, edited-value rule), `length-measurement.test.ts` (`feetInSceneUnit(SYSTEM_BASE_SQUARE_FEET, unit)` exact in every unit, `convertSceneDistance` round trips).
- RELIABILITY-4: DONE once merged. Evidence: `apps/session-worker/test/nativeRoomSquaresScene.test.ts` (Cleaving facts, movement reaction contacts and Darkvision perception on a SQUARES Scene match the FEET Scene), red from a SQUARES throw mutation.
- Edited-value rule above (convert, never reset; Squares forces 1; leaving Squares gives the base square) for the decisions log.
