# Slice workbook: RELIABILITY-4 closeout (SQUARES Scene journey; default distance per cell)

**Status:** OPEN (started 2026-10-13)
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

## Proposed ledger edits (filled by the slice session)
