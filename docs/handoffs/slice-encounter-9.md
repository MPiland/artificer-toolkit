# Slice workbook: ENCOUNTER-9 (declared initiative rolls post a roll card)

**Status:** OPEN (started 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Under `DECLARED_ACTION_ROLL` the room rolls each declared actor's initiative and posts no roll card: `readRoomRollCards` finds no conversation until an attack posts. A GM-rolled initiative (`ROLL_ACTOR_INITIATIVE`) posts one through `recordRuleRollCard` (`packages/encounter-persistence/src/commands.ts`, around lines 376-396). Close the gap so every initiative die rolled for a declaration, auto-rolled or entered through the ADR 0034 roll prompt, posts the same Initiative card a GM-rolled initiative posts, with the same visibility rules.

This is the same gap ENCOUNTER-7.1 closed for turn-stage dice: reuse that path and `recordRuleRollCard`, do not add a second card writer. The card is written in the same transaction as the score, so a retried declaration replays one card, never two (RELIABILITY-3 replay rules).

Read first: ADR 0034, the ENCOUNTER-7 turn-stage dice entries and the declared-initiative entries in `docs/handoffs/phase-08-2-decisions.md` (search `DECLARED_ACTION_ROLL` and `turn-stage`), `packages/rules-runtime/src/encounterInitiativeLifecycle.ts`, `packages/rules-runtime/src/encounterInitiativeScoreBatch.ts`, `packages/encounter-persistence/src/commands.ts`, `packages/encounter-persistence/src/actionRollCards.ts`.

## Closes

- AC ENCOUNTER-9.1.

## File scope

`packages/encounter-persistence` (declaration settlement and roll cards), `packages/rules-runtime` initiative lifecycle only if the rolled die is not already exposed, the Session Worker declaration routes, and `apps/apis/convex/liveSessions` tests. No web change is expected: the table already renders Initiative cards.

## Red-first checklist

1. A declared actor whose initiative auto-rolls posts one Initiative card with the die and total a GM-rolled initiative card shows (fails before the fix).
2. An entered (manual) initiative die posts one card with the entered value.
3. A retried declaration command replays the same card and posts no duplicate.
4. Card visibility matches the GM-rolled initiative card for a hidden Creature and for a player Character.
5. Journey: extend `apps/apis/convex/liveSessions/assistedPartyJourney.test.ts` so every member loads one Initiative card per declared actor.

## Status log

- 2026-10-14: workbook written; session started.

## Proposed ledger edits (filled by the slice session)
