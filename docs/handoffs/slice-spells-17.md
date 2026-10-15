# Slice workbook: SPELLS-17 (placed zones: Caltrops)

**Status:** OPEN (written 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Spatial effects (zones) already resolve when a token moves. They are loaded in `apps/session-worker/src/nativeEncounterMovementInputs.ts`, candidates are collected by `collectSpatialMovementCandidates` in `packages/shared/src/domains/vtt/spatial.ts`, and outcomes execute in `packages/rules-runtime/src/encounterSpatialMovementRuleService.ts`. The store is `packages/encounter-persistence/src/spatialEffectStore.ts`.

Only test fixtures create zones today (`apps/apis/tests/fixtures/spatialEffect.ts`, `apps/session-worker/test/movementRoomFixture.ts`). This slice adds the production creator. SPELLS-20 (auras) and MOVE-3 (traps) build on it.

Source data already authors Caltrops as a generic zone: `packages/source-data/src/srd/equipment/caltrops-bag-of-20.ts`. It is an ACTION with a `MANIFEST` outcome (`manifestKind: 'ZONE'`, `attachmentKind: 'PLACED_SPACE'`, a 5-foot CUBE, label "Caltrop field"). That outcome has an `ENTER_SPACE` component with `bypassAtHalfSpeed`, whose behavior is a DC 15 Dexterity save. On a failure it applies a sequence: `STOP_CURRENT_MOVEMENT`, 1 piercing damage, and a 10-foot walking speed reduction that ends on `ON_HIT_POINTS_REGAINED`.

- **Creator, authorable from core options:**
  - Compile any `MANIFEST` `ZONE` `PLACED_SPACE` outcome into one FIXED spatial effect at the action's chosen point. Its definition is the component's behaviors, its trigger is ENTER, and it takes the authored shape and label.
  - Do it through the existing area-action point target and the System compiler.
  - Nothing Caltrops-specific: no closed rule and no item id checks.
  - The room persists the zone in the action's receipt, so GM undo deletes it, as D99 does for grants.
  - Respect `MAX_SPATIAL_RULE_EFFECTS_PER_SCENE` with a domain refusal.
- **Entry behavior:**
  - A creature entering the zone saves.
  - On a failure, its movement stops, it takes the damage, and it gets the speed reduction as an active effect.
  - A creature that chooses Move carefully (double cost, decision Q2) through the zone skips the save. Approved scope change: the movement command, planner and drag-path preview choice are built here.
- **End reader:** add the `ON_HIT_POINTS_REGAINED` end event. A heal of at least 1 hit point ends the speed reduction. Wire it where the other end events are read, not as a one-off.
- **Label:** the zone row needs its authored label for SPELLS-20 and the map. If the placement or definition contract has no label field, add one to the shared contract in `packages/schema`. That is allowed here: it is a pre-launch persisted shape. Migrate nothing, because no production zone rows exist.
- **Out of scope:** client drawing of zones (projection and map) is SPELLS-20 and VTT_UI-3.1. Auras, start-of-turn zones and token-anchored creation are SPELLS-20. Traps are MOVE-3.

Escalate (`SendMessage` to the main session) only if:

- the authored Caltrops shape cannot be compiled without a source-data or authoring-schema change; or
- the creator needs a transaction-boundary or lock-order change in the Worker's commit.

Read first:

- D99, D103 and the SPELLS-7, SPELLS-13 and SPELLS-24 entries in `docs/handoffs/phase-08-2-decisions.md`.
- `spatialEffectStore.ts`, especially `parseDefinition`, which requires ENCOUNTER origin and lifetime and recurrence NONE.
- `packages/schema/src/shared/spatial.ts`, the placement DTO.
- The movement service above, and `apps/session-worker/test/nativeMovementZoneOverlap.test.ts`.

## Closes

- AC SPELLS-17.1.

## File scope

- `packages/rules-runtime`: the compiler and area action, the movement rule service, and end events.
- `packages/encounter-persistence`: the store, plus the receipt and undo, and the session-state read of half-speed fields.
- `packages/schema`: the label field and the end event, only if missing; the optional `carefully` flag on `MOVE_SCENE_TOKEN`; `halfSpeedFields` on the Encounter session state.
- `packages/shared`: the movement planner and spatial candidate evaluation (`carefully` skips a half-speed component's save; doubled cost share).
- `apps/session-worker`: the native action path that commits the zone, and the movement path that honors `carefully`.
- `apps/web/src/domains/campaigns/vtt`: the drag-path preview choice only ("Move carefully" / "Move normally", decision Q2). Not `CampaignTabletopActionDrawer.tsx`.
- Tests next to each.

## Red-first checklist

1. **Compiler:** the real SRD Caltrops action compiles to a zone-placing plan with a FIXED placement, a 5-foot square, ENTER and the label. Fails on base.
2. **Creator:** committing the action stores one spatial effect at the chosen point. GM undo deletes it. A full scene is refused.
3. **Entry, in the Worker:**
   - a creature that walks into the field and fails the save stops in the field, takes 1 piercing damage, and has its walking speed reduced by 10 feet;
   - a creature that succeeds keeps moving;
   - (3c) a mover who chose Move carefully pays double cost for the field's squares and is not asked to save, through the real movement path.
4. **End:** healing that creature by at least 1 hit point ends the speed reduction. Taking more damage does not.
5. **Journey:** a Worker Encounter journey through real code. A Character spreads real SRD Caltrops in a room, and a creature walks into them, fails, stops, takes the damage and is slowed. A heal clears the slow, and GM undo of the spread removes the field. The journey adds one careful crossing. A component test covers the two preview choices.

## Status log

- 2026-10-14: workbook written.

## Proposed ledger edits (filled by the slice session)
