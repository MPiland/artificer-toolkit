# Slice workbook: ATTACK-17.T1 (the roller sees their own private roll card)

**Status:** OPEN (written 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Before any work, confirm that your worktree is based on `codex/phase-08-2-convex-cutover`. If it is based on `main`, merge the lane branch first. Session cards can't carry the base branch.

Roll cards have two audiences: `TABLE` and `PRIVATE`. A `PRIVATE` card goes only into the GM's history. `readRuleRollRouting` and `recordRuleRollCard` in `packages/encounter-persistence/src/ruleRollCards.ts` decide this.

A roller is private when its actor is not public (D62). A roller is also private when the area's caster can't perceive it: `rollerAsPerceivedByCaster` applies at `evidenceRolls.ts` (about line 259) and `areaCommitPersistence.ts` (about line 480).

In both cases, the player who controls that creature and presses Roll dice gets no card. `evidenceRolls.ts` (about line 274) nulls the roll in that player's answer. AC 17.5 says the player must still see their own card, while the table and the caster must not.

- **Rule:**
  - A `PRIVATE` roll card is retained for the GM, as today.
  - When the roller's controlling member is not the GM, the card is also retained in that member's private roll history.
  - That member's command answer carries the roll.
  - Nobody else gets it: not the table, the caster, or other players.
  - Decide this once, in `recordRuleRollCard`, so both the evidence-roll path and the area-commit path get it. No per-caller branches.
- **Ports:**
  - `retainGmRoll` already takes a user id: the Worker's `apps/session-worker/src/roomEncounterWritePorts.ts` and Convex's `apps/apis/convex/encounters/encounterPorts.ts`.
  - If the port is reused for the player, rename it to describe what it does (for example `retainPrivateRoll`) across every implementation and caller. Don't add a second near-identical port.
  - The Worker already sends a retained private roll only to that user's sockets (`nativeLiveSessionRoom.ts`, about line 2874). Confirm this rather than re-implementing it.
- **GM reveal:**
  - The GM's later reveal of a private roll keeps working unchanged.
  - The player's copy needs no reveal, because it's their own roll.
- **Out of scope:** the target-list and map visibility (ATTACK-17.T2 and T3) and the drawer UI. The Encounter roll-card UI already renders a player's private history entries. If it doesn't, stop and report.

Escalate (`SendMessage` to the main session) only if:

- the player's copy needs a new persisted field or table; or
- the rule conflicts with D62 or D83 as written.

Read first:

- D62, D83 and the SPELLS-7 slice 5e entry (the ISSUER timeline audience) in `docs/handoffs/phase-08-2-decisions.md`.
- `ruleRollCards.ts`, `evidenceRolls.ts` and the `retainGmRoll` implementations.

## Closes

- AC ATTACK-17.5 (task ATTACK-17.T1).

## File scope

- `packages/encounter-persistence`: `ruleRollCards.ts`, `evidenceRolls.ts`, and `areaCommitPersistence.ts` only if a caller must change.
- `packages/encounter-persistence`: the port type.
- The port implementations in `apps/session-worker/src` and `apps/apis/convex/encounters`.
- Tests next to each.
- No web change.

Other sessions are editing `areaCommitPersistence.ts`, `nativeLiveSessionRoom.ts` and `roomEncounterCommands.ts`. Keep your edits there minimal, and merge the base branch before your final batch.

## Red-first checklist

1. **Routing, unit:**
   - A hidden actor controlled by a player rolls. The card is retained for the GM and for that player; no table card is posted.
   - A GM-controlled hidden actor's card is retained for the GM only.
   - A public player actor's card still goes to the table.
2. **Area save, unseen by the caster:**
   - A player's creature that the caster can't perceive rolls its area save.
   - Its controller's answer carries the roll, and their history holds it.
   - The caster's answer and history don't.
3. **Journey:** a Worker Encounter journey through real code.
   - Player A casts an area on Player B's creature, which A can't perceive.
   - B presses Roll dice. B's socket receives the private roll.
   - A's socket and the table's chat receive nothing.
   - The GM's history holds the card.
4. **Regression:** the existing D62 and SPELLS-7 roll-privacy tests pass unchanged.

## Status log

- 2026-10-14: workbook written.

## Proposed ledger edits (filled by the slice session)
