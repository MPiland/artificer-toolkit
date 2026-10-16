# Slice ROOM-6.T1: player-socket and two-controller room fixtures

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- ROOM-6.1: movementRoomFixture offers a player-socket (asPlayer) reactor, proved by a room test that a player socket drives its own Character.
- ROOM-6.9: turnConcentration is proved with two Characters.
- ROOM-6.11: the srdLegendaryAction player-controller and GM-override cases are proved with a two-controller fixture.
- Extend the existing room fixtures (`liveRoomFixture.ts`, `movementRoomFixture.ts`, `actionRoomFixture.ts`); no parallel fixture stack. Keep RELIABILITY-17's fixture isolation guard and `ROOM_REPLY_WAIT`.
- Iterate in CI (`ci/room-6`).

## Acceptance proof

| AC        | Proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Red first                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| ROOM-6.1  | `apps/session-worker/test/nativeMovementPlayerSocket.test.ts`: the room's player owns a Character; `room.asPlayer()` moves it from the player's own socket (committed, the Wolf's reaction raised, the receipt's `actorUserId` is the player), and the same player's answer to the GM-controlled Wolf's decision is refused while the GM's is taken. `movementRoom` gains `asPlayer(who)`, returning `send`/`move`/`respond` on that player's socket; `actionRoom.sendAsPlayer` now delegates to it (one socket sender). | The test calls `asPlayer`, which did not exist at the branch base: it fails there by construction.    |
| ROOM-6.9  | Already proved, no new test. `turnConcentrationFixture` (`apps/apis/tests/fixtures/turnConcentration.ts`) seats two CHARACTER actors with distinct owners in the real room; `turnConcentration.test.ts` asserts per-Character outcomes (a refusal for the other owner at lines 369 and 473).                                                                                                                                                                                                                             | n/a (proof exists)                                                                                    |
| ROOM-6.11 | `apps/apis/convex/encounters/srdLegendaryAction.test.ts`, `it.each(['PLAYER','GM'])`: the dragon's controller is now a second player (`createPartyPlayer`), distinct from the Character's owner (`base.player`). Asserts the controller sees the choice, the Character's owner does not and is refused when answering (choice stays pending), then the controller (PLAYER) or the GM (override) answers.                                                                                                                 | Test-only coverage gap: the behaviour already held with one non-GM user, so no failing-before clause. |

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

| AC                 | Proof                                                                                                                                                                                                                                                                                                                                                                                                                   | Red first                                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| ROOM-6.14 (room)   | `apps/session-worker/test/nativeMovementController.test.ts`: the room's player moves the GM's Wolf, and the second player moves the first player's Character, each on its own socket; both get `COMMAND_REJECTED` / `DOMAIN_REJECTED` / `NOT_ACTOR_CONTROLLER`, and the Run's version, receipts and pending decision are unchanged. The controller's own move of the same Character commits.                            | Red run 38905531310 (`ci/room-6-t4-red`, 16088dba7) was green: the gap the assignment suspected does not exist, so there is no failing-before clause. |
| ROOM-6.14 (Convex) | `apps/apis/convex/liveSessions/encounterMovementAdmission.test.ts`: a player moves the token bound to an actor they do not control through the real room; refused with `NOT_ACTOR_CONTROLLER` and, after a checkpoint, the runs, occurrences, receipts, Scene definition saves, entities and live states are unchanged. The existing first test and `playerControl.test.ts` (owner/player/other predicate matrix) stay. | As above.                                                                                                                                             |

## Log

- Green on `ci/room-6-t4` 51c427bf9: Tests 38908244077, Live backend 38908244041.
- Independent opus review of the test diff (merge-batch-af..51c427bf9) triaged below; merged `ci/merge-batch-ag` before the final push.

## Review triage

- Fixed (high): the Worker "writes nothing" snapshot covered only the Run version, receipts and pending, which a plain move never touches. It now compares the Run documents, turn movements, every `SCENE_CHECKPOINT_ROW` and `SCENE_EVIDENCE_ROW` record, receipts and pending, and the controller's committed move asserts the Scene evidence snapshot changes, so the comparison is shown to detect a write.
- Fixed (low): the Convex snapshot adds `sceneLiveEntities` and `encounterTurnMovements`.
- Stands: `sceneGeometryPublication.ts` runs only in the Worker, so the Convex test proves nothing reaches Convex after the room checkpoints, not a separate Convex check; this satisfies the AC's wording and the finding is recorded above.
- Stands: `otherPlayerControlledActorIds: []` seats the second player by truthiness (the fixture's existing contract); the asserted `NOT_ACTOR_CONTROLLER` reason fails loudly if it broke.

# Slice ROOM-6.T2: maintenance variants proved room-side

## Scope

- ROOM-6.3: multi-Character and detached-Character maintenance variants, plus the CHARACTER-owner producer test.
- ROOM-6.5: empty-prior maintenance (`RETAIN_UNTIL_TERMINAL`) proved room-side.
- ROOM-6.6: Assisted maintenance pauses and stale refusals proved, using the room seed route (`movementRoom({ seed })`).
- Iterate in CI (`ci/room-6-t2`). T1b and T1c stay held.

## Acceptance proof

| AC                                | Proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Red first                                                                                                                                                                                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ROOM-6.3 multi-Character          | `nativeRoomMaintenanceVariants.test.ts`: the Fighter's Targeted Surge replaces a prior state whose dependents sit on the Fighter and a second player's Cleric. Both dependents end, both Characters advance once (`characterOwnerTransitions`, sorted by characterId), and the source Character's stream moves once.                                                                                                                                                                                                                                                                                                                                                                                     | `movementRoom` could not place a dependent on a second Character's page or list owners per maintained state, so the Cleric's dependent could not be seeded: the fixture change is what makes the case provable. The room behaviour was already enforced (no failing-before clause). |
| ROOM-6.3 detached                 | Same file: the GM removes the Cleric's actor first (REMOVE_ACTOR, D82); the replacement still ends the Cleric's dependent and advances the Cleric. A Character that is not a Run actor has no room fixture (the memory store requires the dependent's target actor in the Run): deferred, see Deferred edge cases in `future-enhancements.md`.                                                                                                                                                                                                                                                                                                                                                           | Already enforced.                                                                                                                                                                                                                                                                   |
| ROOM-6.3 CHARACTER-owner producer | Already proved, no new test: `nativeRoomCharacterSources.test.ts` (self Surge as `CHARACTER_MECHANICS_BATCH`; targeted Surge replacing the self state with a Fighter `characterOwnerTransitions` entry). Its Surge fixtures moved to `maintenanceSurgeFixture.ts`, shared with the new file.                                                                                                                                                                                                                                                                                                                                                                                                             | n/a (proof exists)                                                                                                                                                                                                                                                                  |
| ROOM-6.5                          | Same file: a prior state with a Wolf dependent that expires at the Wolf's turn start (`seedTurnSaveEffect` now takes `maintainedEffectStateId`), so the state is empty when the Fighter acts again. `RETAIN_UNTIL_TERMINAL` keeps it through the expiry, and the next action replaces it (`removedDependentEffects` and `characterOwnerTransitions` empty); the `TERMINATE_WHEN_EMPTY` control ends the state with its last dependent, so the next action has no prior. The authored action stays `TERMINATE_WHEN_EMPTY`: the compiler pins that policy (`effectActionCompiler.ts` `maintenancePlan`), so the retain policy is on the prior state's descriptor, as `actionMaintenance.test.ts:562` does. | Already enforced.                                                                                                                                                                                                                                                                   |
| ROOM-6.6 pause                    | Same file: an Assisted Targeted Surge writes no maintenance (states, Character effects, active effects, Character streams) while it waits for the roll or after the roll is only held; the `SYSTEM_ROLL` answer settles the replacement atomically (prior gone, new state and the Wolf's dependent created, both Characters advanced).                                                                                                                                                                                                                                                                                                                                                                   | Already enforced.                                                                                                                                                                                                                                                                   |
| ROOM-6.6 stale                    | Same file: while paused, the Cleric's owner plays an `ADJUST_HIT_POINTS` Sheet command on its own socket; the answer is `COMMAND_REJECTED`, the decision is still pending and nothing is written. A control proves the cause: the same Sheet command with a prior state the Cleric holds no dependent of lets the answer settle, so the refusal comes from the currentness checksum covering the maintenance owners' Character state.                                                                                                                                                                                                                                                                    | Already enforced.                                                                                                                                                                                                                                                                   |

Convex-only stale cases stay where they are proved: a missing definition while paused (`actionMaintenance.test.ts:841`) and a Character no longer ACTIVE (`:722`); the room serves neither.

## Log

- Pushed e20582c09 to `ci/room-6-t2`. Tests 38914875081 failed in the new file only (typecheck and every other job green): `rollDice` only holds a roll, so the Assisted tests never reached the settling command, and the compiler pins authored actions to `TERMINATE_WHEN_EMPTY`.
- Fixed in fe4438689: answer with `SYSTEM_ROLL`; the empty-prior case flips the prior state's descriptor; dropped the unused second definition from the fixture. Tests 38917657292 green.
- Merged `ci/merge-batch-ai` (4ab896590) before the final push.
- Tests 38921560207 (ce6c0d47b) and 38924134501 (1f1e84266) failed in the new file only; each fixed a fixture fault, no product change:
  - a seeded dependent must target a Run actor and carry its state owner as `origin.sourceActorId`, so the outside-the-Run owner was deferred and `seedTurnSaveEffect` takes `maintainedBy`;
  - Character actors need a snapshot that names their Character before the turn can pass to them (`seatedCharacter`);
  - the seeded effect's source occurrence must be the prior state's (`requireTurnMaintainedStates`).
- Merged `ci/merge-batch-ak` and `-an`. Green on `ci/room-6-t2` 894ddca5b: Tests 38935190197, Live backend 38935190347. The light lane was blocked behind other sessions' tickets, so the repro ran in CI.
- Reviewer findings reworked: the RETAIN case now depends on the policy (expiring dependent plus a TERMINATE control); the detached owner outside the Run is deferred (fixture limit); the stale cause is pinned by a control and a pending check; the Assisted settle asserts the replacement and the Wolf's dependent.

## Review triage

Independent opus review of the first T2 diff.

- Fixed: RETAIN not exercised, stale cause unpinned, Assisted settle asserting only the prior's removal, owners not deduped per (state, Character) in `movementRoom`.
- Deferred: a detached owner that is not a Run actor (fixture limit; Deferred edge cases).
- Stands: Character dependents without a `maintainedEffectStateId` are skipped when listing owners; they are valid non-maintained effects, not orphans.
- Stands: a Character that left the Campaign (D81) is skipped by design in `roomEncounterTurnCapture.ts`; its dependents are Convex's to end, so the room test covers GM-removed (D82) and outside-the-Run instead.
