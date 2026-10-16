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
- T6 ruling (Phase 8): option B. Rage ends when the Barbarian's turn ends with no attack roll against a hostile creature and no damage taken since their previous turn (SRD 5.1), by a generic `ON_IDLE_TURN` end event authored from core options. The earlier "start of turn" wording is superseded.
- T6b design (departure from the grant-lifecycle wording: the mark is an actor flag, not a grant field): `idleTurnMark` (`ARMED` / `ENGAGED` / absent) in the actor's free-form `resources`, hashed in `stateChecksum`, replay-safe. Armed where an idle-bound grant is created (`armIdleTurnActor` in `persistEncounterActionEffects`), engaged through one `engageIdleTurnActor` at every attack-roll and damage site (action commit, opportunity attack, Disarm, spell/area attack, reaction attack, damage choke point, Sheet HP decrease, GM HP edit), checked in `persistEncounterIdleTurnCheck` after the turn's Legendary Action damage and before the advance. Only marked actors are ever read, so actors without such a grant incur no extra reads.
- T6b recorded deviation (lenient): a grant created during its holder's own turn arrives `ENGAGED`, so the first check is at the end of the holder's next turn, on every activation path. SRD 5.1 would check the turn Rage begins on.
- T6b undo: the `RESOLVE_ACTION` root carries `idleTurnMarkChanges` (`{ actorId, before }`, default `[]`), diffed before and after the commit; `actionRevert` restores each `before`. Disarm, GM HP edits, Sheet HP changes and movement reactions are not undoable.
- T6b deferred edge cases: a stale mark left by a grant that ended another way is reconciled at the next END_OF_TURN; a second idle-bound grant created on its holder's own turn while already `ARMED` is not exempted; a carried-over idle-bound grant at Run completion.
- T6 tests: unit (`grantLifetimes.test.ts`: `planIdleTurnCheck`, mark helpers, checksum hashing, `attackedHostileCreature`; `idleTurnMark.test.ts`: engage, arm and activation exemption, undo diff), journeys in `rageJourney.test.ts` for the SRD and a homebrew copy (idle turn ends Rage; activation-turn exemption; an attack keeps it for that turn only; damage on another creature's turn keeps it; a Sheet HP decrease keeps it; undo of an attack and of a bite restore the idle end), `rageLegendary.test.ts` (a Legendary Action at the end of an idle turn keeps the Rage), and the SRD Rage parity gate (`AuthoredDomainFieldParity.test.tsx`) requires `ON_IDLE_TURN`. Red-first was proven by CI, not locally.
- `endHolderGrants` narrowed to damaged actors (`movementSettlementPersistence.ts`, test updated); red/green pending CI.

## Proposed ledger and decision edits (main session owns the ledger)

- AC ATTACK-9.3: Action Surge is `ACTION_COUNT SET_VALUE 2` for the turn; idempotent. Follow-up: a second Surge on the same turn (level 17) spends a charge for no gain.
- AC ATTACK-9.6: closed by the Phase 8 option-B wording above; record the activation-turn deviation in its proof.
