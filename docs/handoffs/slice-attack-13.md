# Slice workbook: ATTACK-13

Owned by the ATTACK-13 slice session. Design notes, rulings and proofs go here.

## T1: melee attack marks its target (AC ATTACK-13.1)

Rulings (orchestrator): extend `ATTACKED` with `melee` from the attack's classification; embed the
mark Effect in the MARK definition (no id registry); exclusivity on the grant lifecycle as
`exclusivity: 'PER_SOURCE'` (no prior stacking concept existed); settings gate stays in T3, T1 proves
no mark while the rule is off; SOURCE END_OF_TURN on the attacker's turn ends at its next turn's end.

- ATTACKED subscribers audited: grant subscriptions now carry `meleeOnly`; reaction/retaliation,
  legendary and area paths share `isMeleeAttackSource`.
- Policy `systems/dnd5e/optionalMarkPolicy.ts`; triggers `encounterAttackAppliedEffects.ts` (target facts from the movement target via `effectTarget`, so a Character holder reads its sheet conditions); worker
  main root passes them and adds `replacedEffects` to consumed grants (undo restores them).
- The SRD mark data already authors the opportunity-attack advantage grant; AC 13.2 proves it.
- Deferred to T3: marks from opportunity, legendary and area attacks; the Campaign setting gate.
- `maps/path.ts` growth offset with an `inlineOptions` helper (ADR 0039 ratchet).

Proofs: `rules-runtime/src/__tests__/encounterAttackAppliedEffects.test.ts` (melee/ranged/none, off,
exclusivity, tick count, cross- and same-holder replacement, homebrew parity);
`session-worker/test/nativeRoomMarking.test.ts` (room journey: lasts through next turn, moves and
undo restores, none while off).

## T2: marked opportunity attack with advantage, free once per turn (AC ATTACK-13.2)

Ruling A (orchestrator): a turn-scoped record keyed by `turnSequence` (the zoneApplications pattern),
no refresh writes; it lapses on any new `turnSequence`, GM turn moves included; named by capability
definition id; no compatibility shim.

- New `ENABLE` domain `FREE_OPPORTUNITY_REACTION` on the SRD mark; `encounterGrantsFreeOpportunityReaction`
  scopes it per reactor by the effect's event scope (`fromSourceOnly` = the marker only).
- New refresh boundary `EACH_TURN`; SRD capability "Free reaction allowance" (`...00d9`, maximum 1),
  suppressed by the same conditions as the reaction.
- The D&D eligibility op outputs `freeReaction`; the adapter maps it to the chosen allowance's id,
  maximum and refresh boundary, which the prepare, plan and live persistence spend sites read.
- Undo: a move that settled a reaction cannot be undone (Scene undo refused, action undo
  unavailable), so there is no revert path to restore; the journey proves the refusal keeps the record.
  A write of 0 removes the entry, so a future restore would store the prior row exactly.

Proofs: `rules-runtime/src/__tests__/dnd5eMovementReactionEligibility.test.ts` (granted, free used,
reaction spent, suppressed, cannot act); `encounterTurnUsage.test.ts` (lapse on a new turn, stale
entries dropped, empty record removed, START_OF_TURN unchanged); `encounterAttackAppliedEffects.test.ts`
(marker only; homebrew without `fromSourceOnly` frees anyone); `nativeRoomMarking.test.ts` (room
journey: free advantaged OA, Scene undo refused, second OA spends the reaction, third has none,
PREVIOUS_TURN renews the free one).

## T3: integrate and settings gate (AC ATTACK-13.3)

- `MARK` joins `INTEGRATED_OPTIONAL_COMBAT_RULE_MODULES`, so Campaign settings offer and save it.
- Opportunity attacks (`encounterMovementReactionEffects.ts`) and Legendary Action attacks
  (`encounterTurnLegendaryAction.ts`) build the mover's/target's grant triggers with
  `prepareAttackTargetGrantTriggers`, so they mark; replaced marks join the ended grants.
- Legendary persistence (`turnResourcesPersistence.ts`) reads the grant ids from both mechanics batch
  kinds (Character targets too) and ends the owner's earlier `PER_SOURCE` mark on other holders.
- Deferred: area attacks with an attack roll do not mark (rare; several targets in one command would
  each replace against pre-command effects). Logged in future-enhancements Deferred edge cases.
- Unintegrated fixture in the settings tests moved from MARK to CLIMB_ONTO_LARGER_CREATURE.

Proofs: `apps/apis/convex/campaigns/playSettingsOptions.test.ts` (offers Marking);
`playSettings.test.ts` (an unintegrated rule is still refused); `nativeRoomMarking.test.ts` (an
opportunity attack moves the mark); `nativeRoomLegendary.test.ts` (a Legendary attack marks and moves
the mark between creatures, marks a Character once, none while off).
