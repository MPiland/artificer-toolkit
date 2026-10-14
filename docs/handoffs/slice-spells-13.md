# Slice workbook: SPELLS-13 (cone, line and caster-origin areas)

**Status:** OPEN (started 2026-10-13)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Point-origin areas work (D103, SPELLS-7). Build the areas that start at the caster:

1. **Cones and lines** (Burning Hands, Lightning Bolt, a dragon's breath): the caster picks the origin and the direction, and the area catches and resolves every creature inside it exactly as a point area does (one pending occurrence, sealed saves, frozen damage, GM removal, commit and undo, per-role visibility).
2. **Self-range areas** (Thunderwave's cube): the area starts at the caster, who picks which side of their space it extends from. It never catches the caster unless the action says so, and resolves every other creature as SPELLS-7 does.

**Contract (integration-owner ruling):** the action `target` stays a closed union with no flat alias. Add one member for a directed area, for example `{ kind: 'DIRECTED', origin, toward }` in Scene coordinates, where the origin must lie on the caster's token footprint (an edge or corner of its space) and `toward` sets the direction. A point-area action keeps `{ kind: 'POINT', point }`. A directed target for a point area, a point target for a cone, line or Self area, or an origin off the caster's footprint is refused `TARGET_UNAVAILABLE`. If this shape cannot express a case the SRD needs, escalate before changing it.

Geometry belongs in shared range and area functions that the rules and the stage both read, as the drawer previews do (`packages/shared/src/domains/vtt/sceneRange.ts`): the area the stage draws is the area the server catches. The stage lets the player aim: pick the origin on their token's edge and drag the direction, with the area drawn as they aim, like the existing point aim.

Out of scope: condition and lasting outcomes on areas stay refused until SPELLS-19; Character spell casting is the parallel SPELLS-8.T1 session (prove with Creature actions and authored Effects, as SPELLS-7 did).

Read first: D19, D100, D103 (all of it), D108 in `docs/handoffs/phase-08-2-decisions.md`; `packages/rules-runtime/src/encounterAreaAction.ts`; `docs/architecture/rules-runtime.md`.

## Closes

- ACs SPELLS-13.1 and SPELLS-13.2.

## File scope

`packages/schema` (action target union), `packages/shared` (area geometry), `packages/rules-runtime` area compilation and catching, `packages/encounter-persistence` and the Session Worker area routes, `apps/apis/convex/encounters`, and the web stage aiming and area overlays (`CampaignVttStage.tsx`, `vttSceneRenderer.model.ts`). SPELLS-8.T1 runs in parallel and adds the slot spend to the area commit root; leave the spend and undo of the root to it.

## Red-first checklist

1. A cone from an origin on the caster's edge catches exactly the tokens the 5e cone template touches (15 ft and 60 ft, along a grid axis and diagonally), as decided by the shared geometry function.
2. A line of the authored length and width catches exactly the tokens it touches, in each direction.
3. Thunderwave's cube extends from the chosen side of the caster's space, does not catch the caster, and catches the creatures in it.
4. A directed target for a point area, a point target for a cone, line or Self area, and an origin off the caster's footprint are each refused `TARGET_UNAVAILABLE`.
5. A dragon's breath (a Creature cone) resolves end to end: saves, frozen damage, half on success, undo (Convex through the real room).
6. The stage draws the aimed cone, line and cube from the same geometry function the rules use (a parity sweep like the range previews').
7. Journey: a Creature breathes a cone in a real room, two caught creatures save, damage applies, and the GM undoes it.

## Status log

- 2026-10-13: workbook written; session started.
- 2026-10-13: red-first logs under `local-validation/spells-13/`: `shared-directed-area.red.log` (18 failed), `rules-runtime-directed.red.log` (9 failed: no DIRECTED target kind, no `evaluateEncounterDirectedAreaTarget`, Thunderwave compiled as unsupported, caster caught), `web-directed.red.log` (13 failed against the HEAD stage and drawer). Green: `shared-directed-area.green.log`, `shared-rules.green2.log` (439 shared and rules-runtime tests), `rules-runtime-persistence.green.log` (1081 of 1082; the one failure was a Self sphere still classed POINT, fixed in `encounterActionTargetKind` and covered by the same test), `session-worker-area.green.log` (94 room tests, including `nativeRoomDirectedAreaAction.test.ts`), `web-vtt.green.log` (351 of 352; the one failure is a 5 s timeout in the untouched `CampaignSceneEditor.test.tsx`, rerun in `web-scene-editor.rerun.log`).
- 2026-10-13, after merging the base (`92420bf05`; one conflict in `nativeEncounterAreaRules.ts`, kept the DIRECTED branch and the base's `=== 'SEES'` sight check): `final2-packages.green.log` 1461 of 1462 (the one failure is the known base-red `contentSnapshots.test.ts` 5 s timeout; the first post-merge run, `final-packages.green.log`, failed 86 on a stale `source-data` build and was green after rebuilding `source-data` and `authoring`), `final-session-worker-area.green.log` 94, `final-web-vtt.green.log` 352, `final-typecheck.log` 17 tasks, `typecheck-convex.log` and `final-codegen.log` clean, `apis-playercontrol.log` 6.
- Design as built: the closed target union gains `{ kind: 'DIRECTED', sceneId, expectedSceneVersion, origin, toward }`; a Self cone, line or cube is DIRECTED, a Self sphere, cylinder or circle and a cone or line with another range stay refused. Catching is strict positive-area overlap (separating axis) in `packages/shared/src/domains/vtt/spatial.ts`, shared by the room and the stage; the caster is never caught. The stage presses on the caster's token edge (`nearestFootprintEdgePoint`), drags the direction, and draws `directedAreaOutline`. Architecture: `docs/architecture/rules-runtime.md` ("Directed areas").
- Findings, not changed: point CUBE catching is inclusive at shared edges while directed catching is strict (SPELLS-7 behavior left alone); token rotation is ignored (footprints are axis-aligned); the SRD dragon Fire Breath is not authored as an area, so the proofs use a Creature fixture and the Black Dragon Wyrmling's Acid Breath rewritten to a Self cone; the browser aiming journey and Storybook cannot be run by this session.

## Proposed ledger edits (filled by the slice session)

- AC SPELLS-13.1 (cone and line, origin and direction, catches and resolves like SPELLS-7): closes. Proof: `packages/shared/src/__tests__/vtt-directed-area.test.ts` (cone 15 ft and 60 ft, axis and diagonal, every direction; line in each direction, length and width), `packages/rules-runtime/src/__tests__/encounterAreaAction.test.ts`, `encounterAreaActionCompilation.test.ts`, `encounterAreaActionExecution.test.ts` (target kind, refusals, compiled test plan), `apps/session-worker/test/nativeRoomDirectedAreaAction.test.ts` ("room cone and line", "room refusals of the wrong target for an area", and the "dragon breath journey": two caught creatures save, full and half damage once, GM undo).
- AC SPELLS-13.2 (Self-range area from the caster's side, caster never caught): closes. Proof: the "cube from the caster's side" shared tests, `encounterAreaActionCompilation.test.ts` ("compiles SRD Thunderwave as the cube that extends from the caster"), and "room cube from the side of the caster's space" in `nativeRoomDirectedAreaAction.test.ts`.
- Stage parity (checklist 6): `vttSceneRenderer.model.test.ts` "directed areas" sweeps cone, line and cube over 24 angles and 3 distances and asserts the drawn polygon is `directedAreaOutline` and every token inside it is caught by `spatialTokensInsideArea`; `CampaignTabletopActionDrawer.test.tsx` "directed area (SPELLS-13)" proves the command target and the "In the area" list.
- Journey (checklist 7): the room journey above. A browser journey on the stage (press on the token edge, drag, release) is not run by this session; register it with the Playwright/Storybook work if wanted.
- New follow-ups to register if wanted: a Self sphere, cylinder or circle (an aura or burst from the caster) is still refused; point-CUBE catching is inclusive at shared edges while directed catching is strict; token rotation is ignored by directed footprints; the SRD dragon Fire Breath actions are not authored as Self cones (the Black Dragon Wyrmling's Acid Breath is used in the proofs).
