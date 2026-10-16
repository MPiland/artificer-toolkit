# SPELLS-28.T1b: in-Scene teleport (Misty Step, Dimension Door)

Closes AC SPELLS-28.2. Status: started 2026-10-16, in parallel with SPELLS-28.T2 (which keeps
[slice-spells-28.md](slice-spells-28.md)). T1 (off-Scene TELEPORT, D128) is DONE.

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Approved conditions

The rulings and conditions in [slice-spells-28.md](slice-spells-28.md) "Rulings (main session)" (T1b) and
"T1b conditions (approved)" are binding:

- The cast commits a bounded one-shot teleport allowance on the existing movement-economy pattern (`maxFeet`, kind
  `TELEPORT`, expiring at the end of the caster's turn), not a new contribution kind.
- A following `MOVE_SCENE_TOKEN` TELEPORT consumes it through the spatial movement service as `movementKind: TELEPORT`;
  range, occupancy and visibility are enforced at consumption. A player or actor TELEPORT without an allowance is
  refused; GM moves stay ungated. On web the player picks the destination right after the cast as one flow.
- Cast undo is refused once the move landed; undo order is the move first, then the cast.
- Authored from core options (authoring-parity proof).

## Survey (2026-10-16)

- `misty-step.ts` / `dimension-door.ts` author `TELEPORT` SELF with `VISIBLE` / `SPECIFIED_POINT`, `invocation.range`
  DISTANCE 30 / 500 ft, `targeting` SELF, no outcome `distance`. `supported()` in `effectActionCompiler.ts` refuses them
  today (`supportsSelf` needs `rangeKind: SELF`; SELF teleports are not on its outcome list).
- Dash is the template: a `notOnAList` outcome that compiles to a proposal operation, `[]` applications, a commit that
  reads the stored trace (`executionAddsSpeedToMovement`), a per-turn row in `encounterTurnMovements`, and a command-record
  field (`speedBonusTurn`) that the cast undo reverses (`actionRevert.ts`). The allowance follows it; the new proposal
  carries `maxFeet` (the invocation range) and `destinationKind` as literal inputs/outputs, so the stored trace is the
  authority and persistence needs no compiled action.
- The room owns `encounterTurnMovements` too (`roomEncounterTurnCapture.ts` serves `TURN_USES`), so the gate reads the
  allowance through a new capture request, beside `TURN_USES`.
- Room move path: `roomSceneGeometryStaging` (begin: version, bound-token control) → `prepareNativeLiveMovement`
  (`nativeEncounterMovement.ts`, initial move only when `!response`) → `sceneGeometryPublication` (the VOLUNTARY
  `recordTurnMovement` consume point). TELEPORT already runs the spatial service with `movementKind: TELEPORT` (no
  opportunity attacks; zone triggers still fire) and a path of exactly origin and destination; it spends no walking feet.
- Undo precedent: `publishRoomSceneUndo.onUndone(undoneCommandId)` (concealment prune). Cast undo is the Dash precedent.
- Helpers that exist: `measureSceneDistance` + `sceneLengthInFeet` (range), `sceneTokenFootprintsOverlap` (occupancy),
  `isScenePointExplored(scene, userId, point)` (the visibility proxy: no line-of-sight helper exists).
- Web: `CampaignVttStage.commitTokenMove` sends only `VOLUNTARY`; the readout (`turnMovement`) comes from
  `readTurnMovementView`.

## Design

1. **Allowance storage** (`encounterStoredTurnMovementSchema`): `teleportAllowances` (default `[]`, max 4), each
   `{ castCommandId, maxFeet, destinationKind: VISIBLE | SPECIFIED_POINT, consumedByCommandId | null }`. A list, not a
   slot, so Misty Step (bonus action) plus Dimension Door (action) in one turn keep separate, separately undoable
   allowances. Expiry is free: the next turn reads another `(round, turnActorId)` key.
2. **Compiler**: a SELF `TELEPORT` with `VISIBLE` or `SPECIFIED_POINT` and a positive DISTANCE range compiles to
   `TELEPORT_ALLOWANCE` (`dnd5e.teleport-allowance-proposal`, inputs/outputs `maxFeet`, `destinationKind`); not offered
   after a test; `[]` applications. Other teleport shapes stay refused.
3. **Commit**: `executionTeleportAllowance(execution)` reads the trace; the commit records the allowance on the caster's
   turn row and the command record keeps `{ round, turnActorId }` (`teleportAllowanceTurn`) for the undo.
4. **Gate (room, initial move only)**: a `TELEPORT` by a non-GM bound-token mover must hold an allowance that admits the
   destination: the smallest unconsumed `maxFeet` that covers the measured distance, skipping a `VISIBLE` one when the
   destination is not explored for the mover, and an unoccupied footprint. Refusals: `TELEPORT_UNAVAILABLE` (no
   allowance), `MOVEMENT_BLOCKED` with a specific message for range, unseen, occupied. GM moves are ungated. The chosen
   `castCommandId` rides on the `finish` input (`teleportCastCommandId`) from the room plan to publication.
5. **Consume (publication)**: the first publication of a TELEPORT (`!movementResolution`) marks the chosen allowance
   `consumedByCommandId`, or any unconsumed one for a GM move on a caster that holds one; a GM move with none consumes
   nothing. No walking feet are recorded.
6. **Undo order: move first, then cast.** The GM's scene-move undo (`onUndone`) clears `consumedByCommandId` for that
   command on the actor's current turn row (an expired row has nothing to restore). The cast undo removes its entry and
   is refused (`unavailable`) when that entry was consumed, or its row is gone.
7. **Read model / web**: `turnMovement[].teleport` lists the actor's unconsumed allowances; the stage reads it and,
   while one exists for the dragged token's actor and teleport mode is on (default on when it appears; a toggle in the
   readout turns it off), a drag sends `MOVE_SCENE_TOKEN` `TELEPORT` with `path: [origin, drop]`. One flow: cast, then
   drop.
8. **Authoring parity**: the proof compiles a custom Spell authored only from core options (SELF teleport, DISTANCE
   15 ft, `VISIBLE`) with fresh ids and asserts `maxFeet 15` through the same path; nothing names Misty Step.

D-entry (number pending from the main session): `D-pending-spells-28-t1b`: in-Scene teleport allowance, the gate and the
move-first undo order above. ADR 0034 stays: this is the one enforced exception (a refusal, not a warning) because the
spell grants the move; ordinary voluntary movement stays shown-not-enforced.

## Red-first checklist

- [x] `packages/rules-runtime/src/__tests__/encounterTeleportAllowance.test.ts`: Misty Step and Dimension Door compile
  and execute to the allowance (30 VISIBLE / 500 SPECIFIED_POINT); the custom core-option Spell gives 15; TARGET and
  long-range teleports stay refused. Real authored SRD data, real compiler.
- [x] `packages/encounter-persistence/src/__tests__/turnTeleportAllowance.test.ts`: record, expiry on a new turn, select
  smallest admitting, consume, restore, remove-refused-when-consumed.
- [x] shared `teleportDestination` unit test: range, occupied, unseen, selection order.
- [x] `apps/session-worker/test/nativeRoomTeleportAction.test.ts`: journey on the real room: player casts, the allowance
  appears, the player's TELEPORT lands with no reaction, a second TELEPORT is refused, a player TELEPORT without a cast is
  refused, GM TELEPORT is ungated, undo move then cast restores both, cast undo refused after the move.
- [x] Web model test: allowance in `turnMovement` turns a drag into a `TELEPORT` command; off otherwise.
- [x] Convex/room read-model test: `turnMovement[].teleport` agrees between Convex and the room.

## Status log

- 2026-10-16: branch `claude/spells-28-t1b` from `bc54f43a2`; survey and design written. Next: red tests.
- 2026-10-16: red tests written (rules-runtime, encounter-persistence, shared, session-worker room journey, web stage, Convex read model incl. existing turnMovement assertions gaining `teleport: []`). Pushing to `ci/spells-28-t1b-red`.
- 2026-10-16: red CI (Tests 38923039027, Live backend 38923039051) failed at the shared build: `selectTeleportAllowance` not exported (compile-level red).
- 2026-10-16: implemented (schema, persistence, rules-runtime compiler, shared selector, room gate and undo restore in `roomMoveUndoRestore.ts`, web switch). Merged `ci/merge-batch-ak`. Next: review triage, push `ci/spells-28-t1b`.
