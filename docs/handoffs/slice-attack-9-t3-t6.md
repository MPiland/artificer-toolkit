# Slice ATTACK-9.T6 then T3: Rage early end, Second Wind and Action Surge

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- T6 first (WSJF 7.0), closing AC ATTACK-9.6: Rage ends early at the start of the Barbarian's turn when they neither attacked a hostile creature nor took damage since their previous turn, read from the per-turn Encounter record T2d built (`turnUses`). Also narrow `endHolderGrants` in `movementSettlementPersistence.ts` to the actors the pass damaged: one effect-list read per damaged actor, not per Run actor (free-tier cost).
- T3 second (WSJF 5.5), closing AC ATTACK-9.3: Second Wind (bonus action, 1d10 + Fighter level healing, one use per short rest) and Action Surge (one additional action this turn, uses per short rest by level) resolve through the generic feature-action path, with spend, refresh and GM undo. Action Surge is an action-allowance grant on the existing movement and action economy pattern.
- Both ACs: authored only from core authoring options (no CLOSED_RULE, no feature-specific kind or executor), with a parity proof that an author-built equivalent made through the real authoring form publishes to the same structure and resolves identically.
- Iterate in CI (`ci/attack-9-t6`, then `ci/attack-9-t3`). The light lane is memory-starved while the fleet runs.

## Log
