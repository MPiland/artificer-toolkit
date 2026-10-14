# Slice workbook: RELIABILITY-5.T2 (the Sheet speed override is a length with a unit)

**Status:** OPEN (started 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

RELIABILITY-5.T1 (merged `a11b9d368`, D112 adopted) made authored speed and sense modifiers lengths with a unit. One bare number is left: the persisted Character Sheet `MOVEMENT` adjustment `SPEED_OVERRIDE` (`movementAdjustmentDtoSchema` in `packages/schema/src/api/characterSheet.ts`; `packages/shared/src/domains/character/sheetAdjustment.ts`). It is a non-negative integer in the speed's own unit, so a Character with an override for a speed it has no base for needs the `?? 'FEET'` and `?? 0` defaults in `packages/rules-runtime/src/character/characterMovementRuleFacts.ts` and `sheetPanel.ts`.

Make the override a length `{ amount, unit }` with the D111/D112 shape and bounds (`AUTHORED_LENGTH_AMOUNT_MAX`, the length unit codes). Convert it through the one shared conversion in `packages/shared/src/domains/core/measurement.ts`, and remove both defaults: a speed with no base takes the override's unit and amount, and a speed with neither is never listed. The Sheet's override input (`apps/web/src/domains/characters/sheet/inspector/CharacterSheetRulesPanel.tsx`) takes an amount and a unit, defaulting the unit to the speed's base unit when one exists.

Pre-launch rule: no compatibility shim and no migration code. The main session resets and reseeds local Convex after merge. Update D112 (add a bullet: the Sheet override is a length) and `docs/architecture/rules-runtime.md` if it describes the override.

This is a persisted-contract change the integration owner has already decided (ledger RELIABILITY-5.T2). Escalate only if a consumer cannot take a length without changing other user-visible behavior.

Read first: D111 and D112 in `docs/handoffs/phase-08-2-decisions.md`; [slice-reliability-5.md](slice-reliability-5.md) (the review fix round); the schema and shared adjustment files above; `characterMovementRuleFacts.ts`; `sheetPanel.ts`; `CharacterSheetRulesPanel.tsx`; and the tests that name `SPEED_OVERRIDE` (`character-sheet-adjustment-contracts.test.ts`, `sheetProjectionSpeed.test.ts`, `apps/apis/convex/characters/sheetAdjustments.test.ts`, `characterMaximumHitPoints.test.ts`, `playStateConcurrency.test.ts`, `inspector.fixtures.ts`).

## Closes

- Task RELIABILITY-5.T2, which closes AC RELIABILITY-5.1.

## File scope

`packages/schema` (the adjustment contract), `packages/shared/src/domains/character/sheetAdjustment.ts`, `packages/rules-runtime/src/character` (the movement facts and the Sheet panel), `apps/apis/convex/characters` (the adjustment mutation and its tests), the web Sheet inspector and its fixtures and stories. Regenerate Convex codegen (`api.d.ts`) under the lock.

## Red-first checklist

1. Schema: a `SPEED_OVERRIDE` with `{ amount, unit }` parses; a bare number, an unknown unit or an amount above the bound is refused.
2. Rules: an override of 30 ft on a Character whose base walking speed is in yards (there is no metric length unit, D112) yields the converted effective speed; an override for a speed with no base shows in the override's own unit; a speed with neither base nor override is not listed. There are no `FEET` or `0` defaults in the code (grep the two files).
3. Convex: the Sheet adjustment mutation stores and returns the length; a bare-number payload is refused at the boundary.
4. Web: the Sheet override input sends an amount and a unit, and the panel shows the unit (an RTL test through the real inspector component).
5. Journey: extend the existing Sheet speed journey, or add one if none exists, through the real Convex mutation and the Sheet projection: a player sets a speed override with a unit and reads it back on the Sheet.

## Status log

- 2026-10-14: workbook written.
- 2026-10-14: implementation committed (`9bb81934c`); queued for the validation lock (held by another session).
- Decision: an unheld speed (no base, no override) is `NOT_HELD` in the Sheet panel, with a length editor, matching senses. "Never listed" applies to the rule facts and the policy output (`evaluateDnd5eCharacterMovementAndSenses` throws on a speed with neither). Dropping it from the panel too would stop a Character from adding Fly, a user-visible regression.
- Premise change: `CharacterSheetView.test.tsx` iterated every speed as if it had an amount; it is now `speedKind`-aware because `NOT_HELD` speeds carry no amount.
- Red (production files reverted to `c84ab8c6c`, logs in `local-validation/reliability-5-t2/`): `red-packages.log` exit 1 (schema 2+1 failed, rules 2+3 failed), `red-apis.log` exit 1 (5 failed across 4 files), `red-web.log` exit 1 (3+1 failed). The new rules test first failed on a fixture error (the race override dropped `features: []`); fixed, then `red-rules-rerun.log` (old rules source against the new contract) exit 1 on `ZodError`, the contract mismatch.
- Green on the final tree: `final-packages.log` 29/29, `final-apis.log` 13/13 plus `green-apis-final.log` (`sheetAdjustments`) 6/6, `final-web.log` 44/44, all exit 0. Packages rebuilt first (`build2.log`). Codegen ran under the lock (`codegen2.log`, exit 0): `api.d.ts` regenerated.
- Typecheck: `turbo run typecheck --filter="[c84ab8c6c]"` 14/14 (`typecheck.log`); `apis tsc -p convex/tsconfig.json` clean after moving a `@ts-expect-error` onto the `adjustment` property.
- Defect found by codegen: the panel `speeds` as an intersection made Convex infer `Array<any>`; it is now a flat `discriminatedUnion('speedKind')` over a shared shape (`movementSpeedShape`), and `api.d.ts` carries a real type. Follow-up (not T2): the senses panel (`senses`, D111) is still an intersection and is `Array<any>` in `api.d.ts` at base; the rule-evaluation `movement.speeds` is `Array<any>` at base too.
- Not run: Storybook (cannot start in a worktree); the `MovementInspector` story reads `movementPanelFixture`, which is typed against the new contract and covered by the RTL tests.

## Proposed ledger edits (filled by the slice session)

- Close task RELIABILITY-5.T2; with it, close AC RELIABILITY-5.1 (the Sheet speed override is a length with a unit; the `FEET`/`0` defaults are gone).
- Register follow-up: type the senses panel and the rule-evaluation `movement.speeds` DTOs so Convex stops inferring `Array<any>` (see the status log).
