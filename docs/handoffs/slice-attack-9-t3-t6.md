# Slice ATTACK-9.T6 then T3: Rage early end, Second Wind and Action Surge

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- T6 first (WSJF 7.0), closing AC ATTACK-9.6: Rage ends early at the start of the Barbarian's turn when they neither attacked a hostile creature nor took damage since their previous turn, read from the per-turn Encounter record T2d built (`turnUses`). Also narrow `endHolderGrants` in `movementSettlementPersistence.ts` to the actors the pass damaged: one effect-list read per damaged actor, not per Run actor (free-tier cost).
- T3 second (WSJF 5.5), closing AC ATTACK-9.3: Second Wind (bonus action, 1d10 + Fighter level healing, one use per short rest) and Action Surge (one additional action this turn, uses per short rest by level) resolve through the generic feature-action path, with spend, refresh and GM undo. Action Surge is an action-allowance grant on the existing movement and action economy pattern.
- Both ACs: authored only from core authoring options (no CLOSED_RULE, no feature-specific kind or executor), with a parity proof that an author-built equivalent made through the real authoring form publishes to the same structure and resolves identically.
- Iterate in CI (`ci/attack-9-t6`, then `ci/attack-9-t3`). The light lane is memory-starved while the fleet runs.

## Log

- T3 built, unverified until first CI run: Action Surge converted from `CLOSED_RULE CLASS_FIGHTER_ACTION_SURGE` to a core-authored free self action (charge, TURN/END_OF_TURN `ACTION_COUNT SET_VALUE {amount: 2}`); the closed rule kind is deleted. The action economy takes `max(base maximum, best active ACTION_COUNT SET_VALUE)` via the ACTION binding's `grantedCountDomain`. `turnResourcesPersistence` refresh no longer rejects `used` above the base maximum.
- Second Wind was already core-authored (HEAL 1d10 + CLASS_LEVEL, bonus action, charge); the journey proves it.
- Short-rest refresh of both charges is the generic Sheet recovery (`sheetRestRecoveries`/`sheetResources` tests); the SRD charges use `SHORT_REST`.
- T6 Rage idle-end is blocked on a persisted-contract ruling from Phase 8 (the per-turn record cannot answer "attacked a hostile creature or took damage since the previous turn"). Options A/B sent; recommended B (`activeSinceTurn` on the grant lifecycle plus an `ON_IDLE_TURN` end event).
- `endHolderGrants` narrowed to damaged actors (`movementSettlementPersistence.ts`, test updated); red/green pending CI.

## Proposed ledger and decision edits (main session owns the ledger)

- AC ATTACK-9.3: Action Surge is `ACTION_COUNT SET_VALUE 2` for the turn; idempotent. Follow-up: a second Surge on the same turn (level 17) spends a charge for no gain.
- AC ATTACK-9.6: the SRD ends Rage at the end of the Barbarian's turn, not the start; propose rewording as with D113.3b.
