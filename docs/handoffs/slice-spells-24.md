# Slice workbook: SPELLS-24 (lasting zones catch by positive-area overlap)

**Status:** OPEN (started 2026-10-14)
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

## Proposed ledger edits (filled by the slice session)
