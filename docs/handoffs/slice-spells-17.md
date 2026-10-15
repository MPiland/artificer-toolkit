# Slice workbook: SPELLS-17 (placed zones: Caltrops)

**Status:** DONE, merged aba540d19 (2026-10-15); follow-ups SPELLS-17.T1 to T3 in the ledger
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
- 2026-10-15: slice complete on `claude/reverent-elbakyan-4f4686`; base merged in (commits `5a6da58dc`, merge `18cfe5c2f`). Items 1-5 green with real SRD Caltrops, including the careful crossing (3c). Logs under `local-validation/spells-17/` (red: `red-1-compile.log` to `red-7-web.log`; green: `green-2-shared.log` to `green-7-web.log`, `typecheck-2.log`, `typecheck-3-convex.log` (empty: clean), `typecheck-4-web.log`, `codegen.log`).
- Caveat (flag for the ledger): SRD Caltrops author the interaction as `ENTER_SPACE`, which maps to the ENTER trigger. ENTER fires only when the dragged path ends inside the field; a drag that passes through and ends outside is CROSS and does not trigger. No source-data change made. The ENTER_SPACE wording ("enters") versus pass-through needs a ruling.
- Known gaps (the first three closed by SPELLS-17.T2): GM undo of a heal did not restore the ended slow; Sheet healing outside Encounter mechanics batches did not end `ON_HIT_POINTS_REGAINED` grants; a fully resisted hit was thought to leave the target out of `changed` (it does not; see T2); the stage-level wiring of the careful choice (`commitTokenMove` in `CampaignVttStage.tsx`) has no dedicated test (covered by the component and model tests).
- Storybook (cannot run in a worktree): new `CampaignVttCarefulMoveChoice.stories.tsx` (SingleLabeledField, UnlabeledAndMultipleFields). Suggested stage-level story in `CampaignTabletopWindow.stories.tsx` seeding `halfSpeedFields` so a dragged path ending in a field shows the choice.

## SPELLS-17.T1 (AC 17.2): pass-through triggers

**Status:** DONE, merged e58b9dad8 (2026-10-15); CI 38769788109 and the local reset, seed and audit green. Closes AC 17.2.

The SRD says "Any creature that enters the area must make the save", so a move that passes through a field and ends outside it enters the area; no ruling is needed. `ENTER_OR_PASS_THROUGH` already exists as a generic option (schema enum, node map, `ZONE_INTERACTION_TRIGGER_MODES` to ENTER and CROSS), so the fix is data only: no Caltrops branch.

- Source data: `caltrops-bag-of-20.ts` `ENTER_SPACE` to `ENTER_OR_PASS_THROUGH`; `ball-bearings-bag-of-1000.ts` `MOVE_ACROSS` to `ENTER_OR_PASS_THROUGH` (ENTER_OR_PASS_THROUGH is the instructed kind; the old kind missed a move that ends in the field). Manifest regenerated.
- Tests: Worker `nativeRoomPlacedZone.test.ts` "passing through a caltrop field (SPELLS-17.2)": fail stops at the first square entered (red before the data change), a passed save reaches the end of the move, a careful crossing is bypassed at the doubled cost. Compile parity in `encounterZonePlacementCompilation.test.ts` now expects `['ENTER', 'CROSS']`.
- Docs: `docs/architecture/rules-runtime.md` placed-zones paragraph.

**Other SRD `ENTER_SPACE` zones checked against their own text (not changed here):**

- Oil Flask (`oil-flask.ts:164`): "any creature that enters the area or ends its turn in the area" takes 5 fire damage, once per turn. "Enters the area" is the Caltrops wording, so it should be `ENTER_OR_PASS_THROUGH` (the end-turn component is already right). It does not compile into a zone today (two components, ignition), so there is no live behavior yet.
- Blade Barrier (`blade-barrier.ts:117`): "enters the wall's area for the first time on a turn or starts its turn there". Same wording, so the enter component should be `ENTER_OR_PASS_THROUGH` as Prismatic Wall already is. It is a spell wall, not a point-placed zone, so it is not placed by this creator today.
- Hunting Trap (`hunting-trap.ts:56`): "steps on the pressure plate". Reaching the plate's space means stepping on it, so `ENTER_SPACE` is acceptable; a move that passes over the plate also steps on it, so `ENTER_OR_PASS_THROUGH` is the closer fit. It is authored as an `OBJECT` manifest, not a `ZONE`, so it does not compile into a zone today (the trap flow is MOVE-3).
- Stinking Cloud (`START_TURN_IN_SPACE`) and Prismatic Wall (already `ENTER_OR_PASS_THROUGH`) need no change.

## SPELLS-17.T4 (AC 17.5): the other "enters the area" zones

**Status:** DONE, merged adb748f66 (2026-10-15); CI 38776510529 and the local reset, seed and audit green (the first seed attempt timed out under machine load and passed on rerun; registered as PLATFORM-5.T1). Closes AC 17.5.

Synced to the lane (fast-forward to `1c7829549`, which holds the T1 merge). The T1 text checks found three more SRD components worded "enters the area" or "steps on" that still author `ENTER_SPACE`. Each is now `ENTER_OR_PASS_THROUGH`:

- Oil Flask `Enter burning oil` (`oil-flask.ts`); the end-turn component is unchanged.
- Hunting Trap `Pressure plate` (`hunting-trap.ts`).
- Blade Barrier `Whirling Blades` (`blade-barrier.ts`), which keeps `START_TURN_IN_SPACE`.

Proof: `packages/source-data/src/srd/zoneInteractionKinds.test.ts` asserts the kind per entry (also Caltrops and Ball Bearings from T1). Red before the edit for Oil Flask, Hunting Trap and Blade Barrier (`local-validation/spells-17/t4-red.log`). None of the three compiles into a placed zone today, so there is no live behavior change; the compile parity test covers Caltrops only. Manifest regenerated.

## SPELLS-17.T2 (AC 17.3): heals end the slow everywhere, undo restores it

**Status:** done on the branch; CI run recorded in the report. Closes AC 17.3.

Synced to the lane first. One helper now ends "until healed" grants: `endGrantsOnHitPointsRegained(ctx, owner)` in `consumedGrantPersistence.ts` (select with `grantsEndedBy`, delete, return the records).

- **Encounter batch:** `persistEncounterMechanicsBatchPlan` returns `endedGrants`; the action and area commits pass them to ATTACK-9's `receiptConsumedGrants` as `endedGrants` beside the Run effects' (area collects across children), so they ride the root's `consumedGrants` receipt (synced with ATTACK-9.T1, `13f634280`). GM undo already restores `consumedGrants` through `restoreConsumedGrants`, so the slow comes back with its id and version. No schema change.
- **Sheet:** Convex `executeCharacterSheetCommand` and the room's `executeRoomCharacterSheetCommand` call the helper when the command raises current hit points (`HEAL`, `SET_HIT_POINTS` higher). Damage and a heal that restores nothing leave the grant. Owner is the Character's own grant owner.
- **Fully resisted slow:** a failed save whose damage is fully resisted already applies the slow on base (the target stays in `changed`). It did not reproduce; the Worker test "still slows a creature whose resistance takes the whole of the hurt" is regression coverage.
- **Fixture:** `plannedModifierGrant` takes optional `endOnEvents`. The dnd5e compiler refuses `endOnEvents` on timed grants, so the end-event grants in these tests are untimed.
- **Proof:** Worker `nativeRoomPlacedZone.test.ts` (undo restores the slow; resisted walker), Worker `nativeRoomSheetHealEndsGrant.test.ts` (Sheet heal in a live room), Convex `sheetHealEndsGrants.test.ts` (Sheet heal, damage, zero heal, `SET_HIT_POINTS`). Logs: `local-validation/spells-17/t2-red-*.log`, `t2-green-*.log`.
- **CI:** run 38810469108 on `9a46a5748` (after the ATTACK-9.T1 sync; all other jobs green), 38786427152 on `99c2b68d3` (and 38782976507 on `116953cd5`, which also had the two snapshot mismatches, fixed in `99c2b68d3`). The only remaining failure is `developmentLifecycleProof` at `developmentEncounterTransactions.ts:286` (replayed START returns the player projection), the known base defect PRIVACY-1.T1, not T2.
- **Not covered (no undoable root):** heals through turn effects, turn resources and a GM `UPDATE_ACTOR` edit end the grant but are not undoable; a GM edit of a non-Character actor's hit points does not end it.

## Proposed ledger edits (filled by the slice session)

- Close AC SPELLS-17.1 (creator, entry, end event, careful crossing, journey).
- New follow-up: ruling on `ENTER_SPACE` versus pass-through for Caltrops (authoring/semantics; possibly `ENTER_OR_PASS_THROUGH` in source data).
- New follow-up: stage-level test for the careful-move choice in `CampaignVttStage`.
- Done in SPELLS-17.T2 (AC 17.3): Sheet healing ends `ON_HIT_POINTS_REGAINED` grants and GM undo of a heal restores them.
- Hidden/unnoticed zones stay MOVE-3.3 to 3.5; client drawing of zones stays SPELLS-20 / VTT_UI-3.1.
