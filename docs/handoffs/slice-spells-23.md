# Slice workbook: SPELLS-23 (aiming a directed area on the map)

**Status:** IN PROGRESS (SPELLS-23.T1)
**Base:** `origin/ci/merge-batch-ao` (`4bef5dfc8`).
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

SPELLS-13 built cones, lines and Self cubes and left their aim gesture and a few room paths unproven. Close the two ACs:

- **SPELLS-23.1:** pressing, dragging and releasing on the map aims a cone, line or Self cube and commits exactly the drawn origin and direction; a point picked for a directed area, or a direction for a point area, is refused with its own message; proved through the renderer gesture and the room refusals.
- **SPELLS-23.2:** a Self cube snaps to the grid on the side the caster picks, centered evenly along that side, wherever the caster stands; proved for every side and size.

Also from the SPELLS-13 review: assert the room refusal messages, make `NO_CASTER_TOKEN` honest (it is unreachable in the room), prove `areaMatchesTarget` in the guard path, tighten the diagonal 60 ft cone test to the exact caught set, and fix the test nits (dragon wording in `actionRoomFixture`, drawer fixture `creature-dragon:breath`, "touches" in test titles).

Read first: PRODUCT.md, DESIGN.md, `docs/architecture/rules-runtime.md` (directed areas), `apps/web/src/domains/campaigns/vtt/vttSceneRenderer.ts` pointer handlers, `packages/shared/src/domains/vtt/spatial.ts` (`cubeFromSideOutline`).

## Design (D-pending-spells-23-t1)

1. **Gesture proof.** CI web tests are jsdom and cannot run Pixi. The press/release state machine moves out of the renderer into `vttAreaAimGesture.ts` (the `vttPing.ts` pattern); the renderer's pointer handlers call it, so the test drives the same code the renderer runs. A stage test drives `onAreaDirection`/`onAreaPoint` through the mocked renderer and asserts the command target.
2. **Refusal messages.** `prepareCasterSource` words the wrong-kind refusal by what the action takes: a point action refuses a direction, a directed action refuses a point, each with its own message. Room tests assert the messages.
3. **`NO_CASTER_TOKEN`.** The room reads the caster's token with the area Scene (`readEncounterActionAreaSceneInputs` throws a stale-context error without it), so the refusal is dead there. Delete it and the nullable `sourceToken` of the directed and caster-centered evaluators (pre-launch: no dead code). A caster whose token is gone is a stale Scene context, and a room test proves that.
4. **Cube snap.** A cube from a side snaps to the grid lattice (the Scene grid's `origin` and `cellSize`), not to the caster's own edge. The placements are the lattice positions whose face shares area with the caster's side; where the origin lies along the side picks one, with each placement owning an equal share (`floor`, not `Math.round`). The sealed shape carries `gridOrigin` beside `cellSize`.

## Closes

- ACs SPELLS-23.1 and SPELLS-23.2.

## File scope

`packages/shared` (`spatial.ts`), `packages/schema` (sealed cube shape), `packages/rules-runtime` (`encounterAreaAction.ts`), `apps/session-worker` (`nativeEncounterAreaRules.ts`, tests), `packages/encounter-persistence` (guard test), `apps/web/src/domains/campaigns/vtt` (gesture module, renderer wiring, tests), `docs/architecture/rules-runtime.md`.

## Red-first checklist

1. Gesture: press on the caster's edge, drag, release commits exactly the origin on the edge and the released direction (cone, line, Self cube); a point area commits on press; a release that the rules would refuse commits nothing; Escape/cancel drops the press. (`vttAreaAimGesture.test.ts`)
2. Stage: `onAreaDirection` and `onAreaPoint` from the renderer put exactly that origin/direction into the action target the drawer commits. (`CampaignVttStage.test.tsx`)
3. Room: a point for a directed area and a direction for a point area are each refused `TARGET_UNAVAILABLE` with their own message; the messages are asserted. A caster whose token is gone is refused as stale.
4. Cube snap, every side (N, E, S, W) and size (5, 10, 15, 20, 30 ft edges), on and off the grid, with a caster of 1 and 2 cells: the cube's face lies on a grid line, flush against the chosen side, and each placement owns an equal share of the side. (`vtt-directed-area.test.ts`, `encounterAreaAction.test.ts`)
5. The 60 ft diagonal cone catches exactly the expected set.
6. `requireAreaActionPendingRoot` refuses a sealed area whose origin or direction differs from the command.
7. Test nits fixed.

## Red/green log

Red tests written (checklist items): 1 `vttAreaAimGesture.test.ts` (module absent); 2 `CampaignVttStage.areaAim.test.tsx` (stage wiring, expected green: it proves the stage hands the gesture's output to the drawer command); 3 room messages in `nativeRoomDirectedAreaAction.test.ts`; 4 cube snap and 5 exact 60 ft cone in `vtt-directed-area.test.ts`; 6 `requireAreaActionPendingRoot.test.ts` (expected green: proof only); 7 nits.

| Step  | Run                                                                 | Failing / result                                                                                                                                        |
| ----- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| red   | Tests 38940045467, Live backend 38940045406 (`ci/spells-23-t1-red`) | Failed as intended: Build packages (type errors: `gridOrigin` missing from the cube shape, `createVttAreaAimGesture` module absent) before any test ran |
| green | (pending: `ci/spells-23-t1`)                                        |                                                                                                                                                         |

## Status log

- 2026-10-16: workbook written; session started.
- 2026-10-16: red tests written. Deviation: no room test for a caster whose token is gone. `readEncounterActionAreaSceneInputs` returns a non-null `sourceToken` by type, so deleting the nullable parameter and `NO_CASTER_TOKEN` is proved by the type check; the room fixture cannot drop a token. Storybook not run (cannot run in a worktree).

- 2026-10-16: green implemented: `vttAreaAimGesture.ts` (renderer pointer handlers call it; Escape and `cancelActiveInteraction` cancel the press), cube snapped to the Scene grid lattice with equal shares (`gridOrigin` on the size and the sealed shape), per-kind wrong-target room messages, `NO_CASTER_TOKEN` and the nullable `sourceToken` of the directed, caster-centered and point-area evaluators deleted, docs updated. Merged `origin/ci/merge-batch-aq`.
- 2026-10-16: independent opus review triaged. Fixed: the point-area evaluator's dead null `sourceToken` branch; `DIRECTED_AREA_REFUSALS` renamed `AREA_REFUSALS`; docs corrected (missing caster token is a generic `UNAVAILABLE`, not a refusal; Self cube face vs press). Deferred (future-enhancements): cube smaller than a cell beside a tiny token; off-grid caster's place may not contain the press. Not done: a `CASTER_CENTERED` wrong-target room test; pointer events through the real renderer (Pixi cannot run in jsdom; proved by gesture test plus stage-callback test).
- Open risk (pre-existing, not an AC): a Scene without the caster's token makes the Scene read throw a plain error, so the room answers generic `UNAVAILABLE`; the drawer can send a caster-centered command without checking for the token. Candidate follow-up: turn it into a `TARGET_UNAVAILABLE` refusal with a room test.

## Proposed ledger edits (for the main session)

- SPELLS-23.1 and SPELLS-23.2: close on green; SPELLS-23 DONE.
