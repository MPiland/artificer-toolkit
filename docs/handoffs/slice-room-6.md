# Slice ROOM-6.T1: player-socket and two-controller room fixtures

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- ROOM-6.1: movementRoomFixture offers a player-socket (asPlayer) reactor, proved by a room test that a player socket drives its own Character.
- ROOM-6.9: turnConcentration is proved with two Characters.
- ROOM-6.11: the srdLegendaryAction player-controller and GM-override cases are proved with a two-controller fixture.
- Extend the existing room fixtures (`liveRoomFixture.ts`, `movementRoomFixture.ts`, `actionRoomFixture.ts`); no parallel fixture stack. Keep RELIABILITY-17's fixture isolation guard and `ROOM_REPLY_WAIT`.
- Iterate in CI (`ci/room-6`).

## Acceptance proof

| AC | Proof | Red first |
| --- | --- | --- |
| ROOM-6.1 | `apps/session-worker/test/nativeMovementPlayerSocket.test.ts`: the room's player owns a Character; `room.asPlayer()` moves it from the player's own socket (committed, the Wolf's reaction raised, the receipt's `actorUserId` is the player), and the same player's answer to the GM-controlled Wolf's decision is refused while the GM's is taken. `movementRoom` gains `asPlayer(who)`, returning `send`/`move`/`respond` on that player's socket; `actionRoom.sendAsPlayer` now delegates to it (one socket sender). | The test calls `asPlayer`, which did not exist at the branch base: it fails there by construction. |
| ROOM-6.9 | Already proved, no new test. `turnConcentrationFixture` (`apps/apis/tests/fixtures/turnConcentration.ts`) seats two CHARACTER actors with distinct owners in the real room; `turnConcentration.test.ts` asserts per-Character outcomes (a refusal for the other owner at lines 369 and 473). | n/a (proof exists) |
| ROOM-6.11 | `apps/apis/convex/encounters/srdLegendaryAction.test.ts`, `it.each(['PLAYER','GM'])`: the dragon's controller is now a second player (`createPartyPlayer`), distinct from the Character's owner (`base.player`). Asserts the controller sees the choice, the Character's owner does not and is refused when answering (choice stays pending), then the controller (PLAYER) or the GM (override) answers. | Test-only coverage gap: the behaviour already held with one non-GM user, so no failing-before clause. |

## Log

- Audited the existing proofs; wrote the fixture change and both tests; pushed to `ci/room-6` (32a0a0eb4).
- Live 38900680197 failed on generated-file drift only; merged `ci/merge-batch-ad` (carries the manifest fix; artifact byte-identical to the merged tree), a9babd153.
- Typecheck failed on 32a0a0eb4 (two errors, found by the reviewer and confirmed in CI), fixed next:
  - `commandsOn` was a hoisted function, so the `moverTokenId` narrowing was lost: now a `const` arrow.
  - `sendAsPlayer` now returns the narrowed committed/rejected frame, which made the `nativeRoomPlayerParity.test.ts` `outcome()` guard dead (`never`): collapsed to one ternary; no assertion lost (the type guarantees the two frames).

## Review triage

Independent opus review of 81a17637c..32a0a0eb4.

- Fixed: the two typecheck errors above.
- Stands: the refused Character-owner answer in `srdLegendaryAction.test.ts` is asserted with `rejects.toThrow()` (precedent: `turnConcentration.test.ts:369,473`); the following pending-still-held check and the later accepted answer bound the risk.
- Stands: the refused player answer in `nativeMovementPlayerSocket.test.ts` asserts `COMMAND_REJECTED` only (precedent `nativeRoomReaction.test.ts:325`); the GM's identical answer is then accepted, so only the sender differs.
- Stands: the Legendary test reuses one `commandId` for the refused and accepted attempt (precedent `turnConcentration.test.ts:367`).
- Stands: `RoomChannel` and `actionRoomFixture`'s own socket-pair type are the same shape (nit).

# Slice ROOM-6.T4: a player cannot move a bound token they do not control

## Scope

- ROOM-6.14: a player cannot move an Encounter-bound token their user does not control, in the Worker room and on Convex: the move is refused and nothing is written, proved room-side and on Convex.
- Iterate in CI (`ci/room-6-t4`; red on `ci/room-6-t4-red`).

## Finding

The refusal already exists; no production change. A bound token follows its actor's controllers (ADR 0034), and one predicate decides it on both paths:

- `requireBoundTokenMoveControl` (`packages/encounter-persistence/src/actorController.ts`) runs at `roomSceneGeometryStaging.ts` (Worker, before the staged geometry is written) and `sceneGeometryPublication.ts` (Convex publication). It refuses with the domain rejection `NOT_ACTOR_CONTROLLER`.
- `readLiveMovementAdmission` (`liveMovementAdmission.ts`) calls `requireEncounterActorControl` for a new movement commit: the same code.
- `planLiveSceneCommand` skips the Scene token's own control list for a bound token on purpose; the actor-control seam above is where it is judged.

## Acceptance proof

| AC | Proof | Red first |
| --- | --- | --- |
| ROOM-6.14 (room) | `apps/session-worker/test/nativeMovementController.test.ts`: the room's player moves the GM's Wolf, and the second player moves the first player's Character, each on its own socket; both get `COMMAND_REJECTED` / `DOMAIN_REJECTED` / `NOT_ACTOR_CONTROLLER`, and the Run's version, receipts and pending decision are unchanged. The controller's own move of the same Character commits. | Red run 38905531310 (`ci/room-6-t4-red`, 16088dba7) was green: the gap the assignment suspected does not exist, so there is no failing-before clause. |
| ROOM-6.14 (Convex) | `apps/apis/convex/liveSessions/encounterMovementAdmission.test.ts`: a player moves the token bound to an actor they do not control through the real room; refused with `NOT_ACTOR_CONTROLLER` and, after a checkpoint, the runs, occurrences, receipts, Scene definition saves, entities and live states are unchanged. The existing first test and `playerControl.test.ts` (owner/player/other predicate matrix) stay. | As above. |

## Log

- Green on `ci/room-6-t4` 51c427bf9: Tests 38908244077, Live backend 38908244041.
- Independent opus review of the test diff (merge-batch-af..51c427bf9) triaged below; merged `ci/merge-batch-ag` before the final push.

## Review triage

- Fixed (high): the Worker "writes nothing" snapshot covered only the Run version, receipts and pending, which a plain move never touches. It now compares the Run documents, turn movements, every `SCENE_CHECKPOINT_ROW` and `SCENE_EVIDENCE_ROW` record, receipts and pending, and the controller's committed move asserts the Scene evidence snapshot changes, so the comparison is shown to detect a write.
- Fixed (low): the Convex snapshot adds `sceneLiveEntities` and `encounterTurnMovements`.
- Stands: `sceneGeometryPublication.ts` runs only in the Worker, so the Convex test proves nothing reaches Convex after the room checkpoints, not a separate Convex check; this satisfies the AC's wording and the finding is recorded above.
- Stands: `otherPlayerControlledActorIds: []` seats the second player by truthiness (the fixture's existing contract); the asserted `NOT_ACTOR_CONTROLLER` reason fails loudly if it broke.
