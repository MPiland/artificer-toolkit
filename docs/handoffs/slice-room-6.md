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
