# Slice workbook: ATTACK-13

Owned by the ATTACK-13 slice session. Design notes, rulings and proofs go here.

## T1: melee attack marks its target (AC ATTACK-13.1)

Rulings (orchestrator): extend `ATTACKED` with `melee` from the attack's classification; embed the
mark Effect in the MARK definition (no id registry); exclusivity on the grant lifecycle as
`exclusivity: 'PER_SOURCE'` (no prior stacking concept existed); settings gate stays in T3, T1 proves
no mark while the rule is off; SOURCE END_OF_TURN on the attacker's turn ends at its next turn's end.

- ATTACKED subscribers audited: grant subscriptions now carry `meleeOnly`; reaction/retaliation,
  legendary and area paths share `isMeleeAttackSource`.
- Policy `systems/dnd5e/optionalMarkPolicy.ts`; triggers `encounterAttackAppliedEffects.ts`; worker
  main root passes them and adds `replacedEffects` to consumed grants (undo restores them).
- The SRD mark data already authors the opportunity-attack advantage grant; AC 13.2 proves it.
- Deferred to T3: marks from opportunity, legendary and area attacks; the Campaign setting gate.
- `maps/path.ts` growth offset with an `inlineOptions` helper (ADR 0039 ratchet).

Proofs: `rules-runtime/src/__tests__/encounterAttackAppliedEffects.test.ts` (melee/ranged/none, off,
exclusivity, tick count, cross- and same-holder replacement, homebrew parity);
`session-worker/test/nativeRoomMarking.test.ts` (room journey: lasts through next turn, moves and
undo restores, none while off).
