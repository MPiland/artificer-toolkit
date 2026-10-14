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

## Proposed ledger edits (filled by the slice session)
