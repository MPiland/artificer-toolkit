# Slice workbook: VTT_UI-3.1 range and target previews from the drawer; PLATFORM-12.1 drawer fixtures

**Status:** OPEN (started 2026-10-13)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Two web-only pieces in `apps/web/src/domains/campaigns/vtt`, both unblocked by ATTACK-18 slice D.

1. **VTT_UI-3.1 range and target previews.** Each encounter action choice already carries `range` (`SELF`, `WITHIN`, `RANGED`, `UNLIMITED`) and `rangeLabel` (lane 1 option A, contract step 1, done). Build step 2: while an action is chosen in the action drawer, the stage draws the existing RANGE and TARGET overlays around the acting token from that `range` (normal and long for `RANGED`; nothing for `SELF` or `UNLIMITED`), and the chosen target(s). Use one callback prop plus an effect, the `onAreaShapeChange` pattern the drawer already uses for point areas. The client derives nothing from rules: it draws the server's `range` in Scene units. Clearing the choice or closing the drawer removes the overlays. Aura and trap previews stay BLOCKED (SPELLS-17, SPELLS-20); add no speculative DTOs.
2. **PLATFORM-12.1 drawer fixtures.** Lane 3 held these until slice D merged: the `CampaignTabletopActionDrawer` stories and test, `CampaignTabletopBasicActions` and `CampaignTabletopEscapes`. Their fixture data parses through the shared DTO schemas via `apps/web/src/test/validatedFixture.ts`, and mocks name functions through the generated `api` refs. Also `apps/web/src/data/campaigns/encounterActions.ts` builds its reference with `makeFunctionReference('encounters/actionChoices:get')`; use the generated `api` ref. Fix fixture data that fails its schema in the data, never by loosening the schema.

Read first: `docs/handoffs/lane-3-vtt-ui.md` (VTT_UI-3.1 option A), `docs/handoffs/lane-2-platform-closeout.md` (PLATFORM-12.1 list), D106 slice D note on the choice `target` shape, DESIGN.md and PRODUCT.md for the overlay look.

## Closes

- VTT_UI-3.1 range and target parts (the AC stays IN_PROGRESS for aura and trap). PLATFORM-12.1 (last open folder).

## File scope

`apps/web/src/domains/campaigns/vtt/**`, `apps/web/src/data/campaigns/encounterActions.ts`, `apps/web/src/test/validatedFixture.ts`. Out of scope: server packages and the Scene preparation screen (`CampaignScenePreparation*`, owned by the parallel RELIABILITY-4 session).

## Red-first checklist

1. Choosing a ranged weapon attack in the drawer draws the RANGE overlay with normal and long radii from the choice's `range` (unit test on the stage model plus a story with a play assertion).
2. A reach or touch action draws its `WITHIN` radius; a `SELF` and an `UNLIMITED` action draw none.
3. Picking a target draws the TARGET overlay on it; clearing the choice or closing the drawer removes both overlays.
4. The held drawer fixtures parse through their DTO schemas; a deliberately invalid fixture fails `fixtureContracts.test.ts` (or the validated-fixture helper) first.
5. `encounterActions.ts` uses the generated `api` ref; a test asserts the mocked function by that ref.

## Status log

- 2026-10-13: workbook written; session started.
- 2026-10-13: red-first. Checklist 1-3 red in `local-validation/vtt-ui-3-1-drawer/red-unit.log` (13 failures: `actionPreviewOverlays`, drawer `onActionPreviewChange`), then `red-stage-overlays.log` (2 failures: `stageOverlays is not a function`, the drawer-open gating and area-aiming composition). Green: `green-unit-1.log` (93 tests, 3 files), `green-unit-2.log` (81 tests, model and drawer files). Typecheck app, tests and stories green in `typecheck-3.log` (`typecheck.log` and `typecheck-2.log` caught a stale `areaOverlays` reference and a tuple cast, both fixed).
- Checklist 1-3 done. `actionPreviewOverlays` and `stageOverlays` are in `vttSceneRenderer.model.ts`. RANGED draws normal and long RANGE circles, WITHIN one, SELF/UNLIMITED/scaled none, and a TARGET ring goes on the chosen target. The drawer reports one `onActionPreviewChange(preview | null)` callback through an effect that clears on unmount. The stage keeps the preview only while the drawer is open, including while an area center is aimed. Aura and trap previews stay BLOCKED.
- Checklist 4 done. Every drawer test and story fixture goes through `validated(...)` with its DTO schema and parsed on the first run, so no fixture data changed. `src/test/validatedFixture.test.ts` proves an off-contract literal fails the helper (the helper had no test before).
- Checklist 5: no change needed. `encounterActions.ts` already calls `api.encounters.actionChoices.get`/`.optional` through the generated ref, so a wrong name is a compile error. I added no thin data-layer test: the optional-choices input and output schemas are large and a hand-built pair would copy product shape into the test. The `CampaignTabletopWindow` story already mocks `convexApi.encounters.actionChoices.get`.
- Deviation: lock waits were long (two 20-minute waits starved); the runner retries every 10 s instead of 30 s.
- Storybook runs not done (no Storybook run in this session): `CampaignTabletopActionDrawer` stories including new `PreviewRangeAndTarget`, `CampaignVttPresentation` new `ActionRangeAndTargetPreview` (asserts `overlayCount: 3`), and the `CampaignTabletopWindow` journey.

## Proposed ledger edits (filled by the slice session)

- VTT_UI-3.1: range and target parts done (proof: `vttSceneRenderer.model.test.ts` `action preview overlays`, `CampaignTabletopActionDrawer.test.tsx` `range and target preview (VTT_UI-3.1)`, stories `PreviewRangeAndTarget` and `ActionRangeAndTargetPreview` written but not run). The AC stays IN_PROGRESS for aura and trap previews.
- PLATFORM-12.1: last open folder (the drawer fixtures) done. Proof: drawer test and story fixtures parse through `validated(...)`, and `validatedFixture.test.ts` shows an invalid fixture fails.
