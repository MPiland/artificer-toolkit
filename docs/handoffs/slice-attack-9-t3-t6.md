# Slice ATTACK-9.T6 then T3: Rage early end, Second Wind and Action Surge

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- T6 first (WSJF 7.0), closing AC ATTACK-9.6: Rage ends early at the start of the Barbarian's turn when they neither attacked a hostile creature nor took damage since their previous turn, read from the per-turn Encounter record T2d built (`turnUses`). Also narrow `endHolderGrants` in `movementSettlementPersistence.ts` to the actors the pass damaged: one effect-list read per damaged actor, not per Run actor (free-tier cost).
- T3 second (WSJF 5.5), closing AC ATTACK-9.3: Second Wind (bonus action, 1d10 + Fighter level healing, one use per short rest) and Action Surge (one additional action this turn, uses per short rest by level) resolve through the generic feature-action path, with spend, refresh and GM undo. Action Surge is an action-allowance grant on the existing movement and action economy pattern.
- Both ACs: authored only from core authoring options (no CLOSED_RULE, no feature-specific kind or executor), with a parity proof that an author-built equivalent made through the real authoring form publishes to the same structure and resolves identically.
- Iterate in CI (`ci/attack-9-t6`, then `ci/attack-9-t3`). The light lane is memory-starved while the fleet runs.

## Log

- T6 ruling (Phase 8): option B. Rage ends when the Barbarian's turn ends with no attack roll against a hostile creature and no damage taken since their previous turn (SRD 5.1), by a generic `ON_IDLE_TURN` end event authored from core options. The earlier "start of turn" wording is superseded.
- T6 design: the "engaged since last turn" mark is `engagedSinceTurn` in the actor's free-form `resources` JSON, not a grant field. It is hashed in `stateChecksum` already, survives replay, and needs no new persisted grant contract (the ruling's `activeSinceTurn` on the grant was not needed). Set sites: the action commit (source: `engagesSource` from the worker, which is true only for an attack roll by a holder of an `ON_IDLE_TURN` grant, then verified from the d20 `resultPath` and dispositions, so no extra reads) and the damage choke point `persistEncounterMechanicsBatchPlan` (target: `damageEngagesGrantHolder`, one effects read per damaged actor not yet engaged; nothing for actors without the grant). Checked and cleared at END_OF_TURN in `persistEncounterGrantTicks` via `planIdleTurnGrantEnds`.
- T6 recorded deviation (lenient): a grant created during its holder's own turn marks the holder engaged, so the first check is at the end of the holder's next turn. SRD 5.1 would check the turn Rage begins on.
- T6 undo: `RESOLVE_ACTION` root gains `engagedActorIds` (default `[]`); `actionRevert` clears exactly the marks that action newly set. Area and action commits record them.
- T6 not covered: attack rolls by spell or area actions, Disarm, reaction attacks and Cleaving attacks do not set the source mark; damage from the cleaving, basic-action, turn and scene-geometry sites still marks the damaged holder, but their undo does not clear it (leaves Rage lenient).
- T6 tests: unit (`grantLifetimes.test.ts`: `planIdleTurnGrantEnds`, mark helpers, checksum hashing, `attackedHostileCreature`), journeys in `rageJourney.test.ts` for the SRD and a homebrew copy (idle turn ends Rage; activation-turn exemption; an attack keeps it for that turn only; damage on another creature's turn keeps it; undo of an attack and of a bite restore the idle end), and the SRD Rage parity gate (`AuthoredDomainFieldParity.test.tsx`) now requires `ON_IDLE_TURN`. Red-first was proven by CI, not locally.
- `endHolderGrants` narrowed to damaged actors (`movementSettlementPersistence.ts`, test updated); red/green pending CI.

## Proposed ledger and decision edits (main session owns the ledger)

- AC ATTACK-9.6: closed by the Phase 8 option-B wording above; record the activation-turn deviation in its proof.
- Follow-up: the undo of damage marks at the non-action damage sites (cleaving, basic actions, turn, scene geometry) and attack rolls from spell/area/Disarm/reaction sources do not set or clear the mark.
