# Slice workbook: ATTACK-17.T5 (private concentration check cards reach the controller)

**Status:** in progress
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

ATTACK-17.T1 (merge 9dac2816c) gave private rule-roll cards a player copy. When a player controls the rolling creature and its card is kept from the table, `recordRuleRollCard` in `packages/encounter-persistence/src/ruleRollCards.ts` retains the GM's card and a generic copy in that player's private history (`playerCopyUserId`). The live Worker room carries that copy to the player.

The concentration check skipped that change. In `packages/encounter-persistence/src/concentrationRollPersistence.ts` the `PRIVATE` branch retains the card for the GM only. So a player whose hidden concentrating creature takes damage never sees their own Constitution save.

- Route the concentration check's private branch through the same player-copy rule as `recordRuleRollCard`. `readRuleRollRouting` already returns the controller as `authorUserId` (the owner when the controller has left). The player copy goes to that controller unless it is the owner. It holds the generic roll with no creature reference.
- Keep one routing point. If the private retain needs sharing between `recordRuleRollCard` and the concentration path, extract the shared part once in `ruleRollCards.ts` and use it in both. Do not copy the GM-plus-player retain logic. The TABLE branch of the concentration path keeps its own conversation insert; do not change it.
- The player copy must reach the player the same way ATTACK-17.T1's does, on the Convex routes and in the live Worker room (checkpoint commit and replay). Find how T1 carried `playerCopyUserId` through the answer and the checkpoint, and follow it for the concentration check. Do not invent a second path.
- Out of scope: `concentrationEnd.ts`. Its end notice is a chat message, not a roll card, and it posts nothing for a hidden creature. Record that in the status log as a possible follow-up; do not change it here.

Escalate (`SendMessage` to the main session) only if:

- the player copy cannot reach the live room without a checkpoint or transport contract change; or
- the change needs a different audience rule than D62 and D83 give.

Read first:

- D62 and D83 in `docs/handoffs/phase-08-2-decisions.md`, and the ATTACK-17.T1 entry if present.
- `ruleRollCards.ts` (`readRuleRollRouting`, `recordRuleRollCard`) and `concentrationRollPersistence.ts`.
- The T1 proofs: `packages/encounter-persistence/src/__tests__/ruleRollCards.test.ts`, `apps/apis/convex/encounters/evidenceRolls.test.ts`, `apps/apis/convex/liveSessions/checkpoint.test.ts`, `apps/session-worker/test/nativeRoomAreaJourney.test.ts`.
- Use `git show 9dac2816c --stat` to see what T1 touched.

## Closes

- AC ATTACK-17.6: a player who controls a hidden concentrating creature sees that creature's concentration check card as their own private card. Other players do not, and the GM keeps the full card.

## File scope

- `packages/encounter-persistence`: `ruleRollCards.ts` and `concentrationRollPersistence.ts`, plus tests.
- `apps/apis/convex` and `apps/session-worker`: only where T1's player-copy path needs the concentration check wired in, plus tests.

## Red-first checklist

1. **Persistence unit:** a hidden concentrating creature controlled by a player fails or passes a concentration check. The GM's private history holds the full card with the creature reference. The controller's history holds the generic copy. Nothing is posted to the table. A GM-controlled hidden creature gets no player copy, and a creature whose controller has left falls back to the GM only. Fails on base.
2. **Convex:** the same case through the real Convex damage path. The controlling player reads their own card and another member reads nothing.
3. **Journey (Worker room):** a player controls a hidden concentrating creature. The GM's attack hits it, the check rolls, and the controlling player's socket receives their private card, while a second player's socket and the table do not. Checkpoint replay keeps the player copy.
4. Rerun the T1 proof files above, unchanged and green.

## Status log

- 2026-10-15: workbook written.

## Proposed ledger edits (filled by the slice session)
