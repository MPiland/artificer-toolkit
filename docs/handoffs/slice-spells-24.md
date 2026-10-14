# Slice workbook: SPELLS-24 (lasting zones catch by positive-area overlap)

**Status:** DONE (merged `b0a2345d5`; closed by the main session 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

User ruling 2026-10-14 ("Same overlap rule"): lasting and moving zones (Spirit Guardians, Moonbeam, Cloud of Daggers) affect a creature on entry, at the start of its turn and in perception only when the creature's footprint overlaps the zone with positive area. This is the rule D103 "Catching" already fixed for area actions. A creature that only touches the zone's edge or corner is not affected.

Today zones still use the inclusive `footprintIntersectsSpatialGeometry` in `packages/shared/src/domains/vtt/spatial.ts`. It is reached through the exported `spatialGeometryIntersectsTokenFootprint`, the movement-trigger checks (`candidateContact`, `movementTrigger`), `collectTokenFootprintPathCrossings` and `collectSpatialMovementCandidates`. Their rules-runtime consumers are `encounterTurnEffectPerception.ts`, `encounterMovementReactionPerception.ts`, `encounterSpatialMovementRuleService.ts` and `encounterMovementPassageContacts.ts`.

Area catching already uses the positive-area test: `distanceFromFootprint < radius` for a radius, and `convexPolygonsOverlap` (the separating axis theorem without the boundary) for a polygon, inside `spatialTokensInsideArea`. Make zones use that same single test, so areas and zones share one overlap predicate in `spatial.ts`. Then retire the inclusive path entirely, unless a non-zone consumer genuinely needs touching semantics.

Check one consumer before changing it: `packages/shared/src/__tests__/vtt-fog-contact-exploration.test.ts` exercises these functions for fog and exploration contact. Decide from the code and the decisions doc whether fog contact is a zone rule. If it is not, and it needs inclusive contact, keep that path for it alone and record why in the status log. Escalate to the main session only if the answer would change user-visible fog behavior.

A path that only grazes a zone's edge or corner is not an entry. A path whose footprint crosses into the interior is an entry, even if it starts and ends outside.

Amend D103 "Catching" (or add a short bullet that cites it) in `docs/handoffs/phase-08-2-decisions.md` to say that lasting and moving zones use the same overlap rule. Update `docs/architecture/` too if a guide describes zone contact.

Read first: D103 in `docs/handoffs/phase-08-2-decisions.md` (the "Catching" bullet); the decisions that cover lasting zones, recurring zone effects and movement-triggered effects (search for `Spirit Guardians`, `Moonbeam`, `entry`, `start of its turn`); `spatial.ts`; and the four rules-runtime consumers above with their tests.

## Closes

- AC SPELLS-24.1.

## File scope

`packages/shared/src/domains/vtt/spatial.ts` and its tests, the four rules-runtime consumers and their tests, the Session Worker or Convex tests that cover zone entry and start-of-turn effects, and the D103 amendment. No web change is expected. The web draws zones and does not decide contact; confirm this with a grep.

## Red-first checklist

1. Shared unit tests: a token touching a radius zone's edge, a polygon zone's edge, or a polygon zone's corner is not in the zone; a token overlapping by any positive area is in. These fail before the change.
2. Path crossings: a move that slides along a zone's edge or grazes a corner reports no entry; a move that cuts through the interior reports entry. Both fail before the change for the graze.
3. Start-of-turn: a creature whose footprint only touches Spirit Guardians' edge is not affected at the start of its turn (rules-runtime `encounterTurnEffectPerception` test). This fails before the change.
4. Movement reaction perception: a creature that only touches a zone's edge is not perceived as inside it (`encounterMovementReactionPerception` test).
5. Assertions that expect inclusive contact must change. List each one in the status log as a premise change citing the user ruling. Never edit one silently.
6. A room or Convex journey test, through real commands, in which a creature moves to touch a Moonbeam or Spirit Guardians edge without taking the effect, and then moves inside and takes it.

## Status log

- 2026-10-14: workbook written.
- 2026-10-14 implementation (user ruling 2026-10-14, "Same overlap rule", D103): `spatial.ts` now has one overlap predicate, `footprintOverlapsSpatialGeometry` (circle `distanceFromFootprint < radius - EPSILON`; polygon `convexPolygonsOverlap`, touching counts as separated). `spatialTokensInsideArea` (areas), `candidateContact` and `movementTrigger` (zone entry, exit, cross) and the exported zone predicate, renamed `spatialGeometryOverlapsTokenFootprint` (start-of-turn and movement-reaction perception), all use it. The inclusive `footprintIntersectsSpatialGeometry` and the now-unused `pointInPolygon` are deleted.
- Fog finding: fog and passage contacts never used the inclusive path. `collectTokenFootprintPathCrossings` was already strict, so no consumer needs touching semantics and nothing is kept. No user-visible fog change. `apps/web` has no reference to the retired names (grep); the web draws zones and does not decide contact.
- Docs: D103 "Catching" amended and the zone rule added to `docs/architecture/rules-runtime.md` ("Catching" paragraph). No other architecture guide describes zone contact (grep).
- Checklist and logs (all under `local-validation/spells-24/`; red = base inclusive `spatial.ts` with only the export renamed, green = committed code):
  1. Shared unit tests (`vtt-spatial.test.ts`: radius edge, polygon edge, polygon corner not in; positive overlap in): red `red-unit.log`, green `green-shared.log`.
  2. Path crossings (edge slide and corner graze give no entry, a corner clip gives CROSS, a tangent teleport gives nothing, a teleport that overlaps gives ENTER): same logs.
  3. Start-of-turn (`encounterTurnEffectPerception.test.ts`, new): red `red-unit.log`, green `green-rules-runtime.log`.
  4. Movement reaction perception (`encounterMovementReactionPerception.test.ts`, new): same logs.
  5. Premise change: one assertion expected inclusive contact, "reports the last inclusive tangential full-footprint boundary as the exit contact" (2x2 token sliding along a radius-1 circle expected an EXIT at contact (1,2)). It is now "reports no contact for a path that only touches the zone tangentially" and expects `[]`, on the 2026-10-14 ruling (D103). No other assertion changed.
  6. Journey through real room commands (`apps/session-worker/test/nativeMovementZoneOverlap.test.ts`, new; `movementRoomFixture.move` takes an optional `expectedSceneVersion`): touching a zone edge commits with no receipt, then moving inside takes the effect; a tangent slide takes none. Red `red-journey.log` (2 failed: the touch move took the effect), green `green-session-worker.log`.
- Red: 7 failed, 33 passed in `red-unit.log`; 2 of 2 journey tests failed.
- Green: all `packages/shared` vtt tests (10 files, 164 tests); rules-runtime `encounterTurnEffectPerception`, `encounterMovementReactionPerception`, `encounterMovementReactionContacts`, `encounterTurnEffects`, `encounterMovementPassage`, `encounterMovementConcentrationEnd` (6 files, 31 tests); session-worker `nativeMovementZoneOverlap`, `nativeMovementPlanning`, `nativeMovementEvidence`, `nativeMovementConcentrationEnd`, `nativeMovementDecisionReplay` (5 files, 48 tests). Base `codex/phase-08-2-convex-cutover` merged before the green run.
- Typecheck: `turbo run typecheck --filter="[codex/phase-08-2-convex-cutover]"` with `GOMAXPROCS=2`, `--concurrency=1`, `--env-mode=loose` passed, 13 of 13 tasks (`typecheck.log`). `apps/apis` Convex test typing was not touched, so `tsc -p convex/tsconfig.json` was not run.
- Deviations: the rename and the doc edits were made with `sed` and a one-off `node` script rather than the Edit tool (content checked by grep). The first lock hold was wasted on a worktree with no `node_modules`; the main session had me run `yarn install` in the worktree. A second hold built `design-system`, `source-data` and `authoring`, which the tests read from `dist`.
- Review fix (main-session finding: SAT is wrong for the concave simple polygons that `spatialPolygonDtoSchema` and `validSpatialGeometry` accept; a token in the notch of an L-shaped zone was caught): the polygon branch of `footprintOverlapsSpatialGeometry` now clips the polygon against the footprint rectangle (`polygonFootprintOverlapArea`, Sutherland–Hodgman plus shoelace) and catches only when the clipped area exceeds EPSILON. One predicate for every polygon; `convexPolygonsOverlap` and `footprintCorners` are deleted; the "must be convex" claims are gone from the JSDoc and D103. New concave L-shape tests in `vtt-spatial.test.ts`: notch not caught, arm overlaps caught, inner-corner touch not caught, notch-plus-arm caught. Red on the SAT predicate (`red-concave.log`): the notch and inner-corner tests fail, 2 failed, 38 passed. Green after the base is merged: `green3-shared.log` (10 files, 168 tests), `green3-rules-runtime.log` (6 files, 31), `green3-session-worker.log` (5 files, 48), `typecheck3.log` (`turbo run typecheck --filter="[codex/phase-08-2-convex-cutover]"`, 15 of 15 tasks). The earlier concave-polygon open risk is closed.
- Not run: Storybook and web e2e (none touched). No Convex test touched, so no apis run.

## Proposed ledger edits (filled by the slice session)

- AC SPELLS-24.1: met; proof is the checklist above (`vtt-spatial.test.ts`, `encounterTurnEffectPerception.test.ts`, `encounterMovementReactionPerception.test.ts`, `nativeMovementZoneOverlap.test.ts`).
- Any ledger note that names the inclusive `footprintIntersectsSpatialGeometry` or `spatialGeometryIntersectsTokenFootprint` should say they are retired in favor of `footprintOverlapsSpatialGeometry` / `spatialGeometryOverlapsTokenFootprint`.
