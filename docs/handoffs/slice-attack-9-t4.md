# Workbook: ATTACK-9.T4 Divine Smite and Improved Divine Smite (AC ATTACK-9.4)

**Status:** DONE 2026-10-16. Merged with merge batch k at `1aed8c7ef`; tip `b7ed9081e` is green on Tests 38862637381 and Live backend 38862637798. Branch `claude/stoic-hypatia-f53439`, CI branch `ci/attack-9-t4`. The sections below are the historical design record; the creature-type check is now one of the attack circumstances (`Dnd5eAttackCircumstances.targetCreatureTypeId`) beside roll mode and enemy proximity.
**Base:** phase branch `codex/phase-08-2-convex-cutover`, T2a (`6fb948a36`, riders) merged in.

## Brief

AC ATTACK-9.4: after a Paladin hits with a melee weapon attack, the player may spend a spell slot to add 2d8 radiant (+1d8 per slot level above 1st, max 5d8; +1d8 against undead or fiends), doubled on a critical hit; Improved Divine Smite adds 1d8 radiant to every melee weapon hit. Authored only from core authoring options; an author-built equivalent made through the real authoring form publishes to the same structure and resolves identically.

Before this slice both Paladin Features (`packages/source-data/src/srd/classes/paladin.ts`) were inert `CLOSED_RULE` effects; they are now authored from core options and the two closed-rule kinds are deleted.

## Survey findings

| Part | What exists | Gap |
| --- | --- | --- |
| Improved Divine Smite (unconditional 1d8 radiant on every melee weapon hit) | D119(a) names it as the user of the T2a rider merge (`characterOnHitRiders.ts`: trigger-matched `PASSIVE` Feature `ON_HIT` `DAMAGE` merged into the weapon action, crit-doubled, resisted) | Nothing new once T2a merges. Authoring only. |
| Crit doubling and resistance of the Smite dice | Existing: any `ON_HIT` damage in the compiled effect doubles (D58) | None, if the Smite dice join the same compiled outcome. |
| Scaling by slot level | `spellCastLevel` fact and the compiler's `selectScalingRow` (D118), used today for heals and Absorb Elements (`effectAtCastLevel`) | Damage rows for a rider need the fact bound while the weapon action is built. |
| Undead or fiend bonus 1d8 | Facet predicate `CREATURE_TYPE` exists (`facetPredicate.ts`) | Not usable as a condition on an outcome row or a second damage part. D119(d)/(e) add predicate evaluation at outcome selection; this part needs the target-creature-type fact in the same place. |
| Post-hit choice by the attacker (slot spend) | **No attacker-side pause exists.** The only mid-attack pauses are defender-side: `reactionChoice` (Shield, Absorb Elements; after TEST, before OUTCOME; roller must be the reactor, `encounterActionPending.ts` refinement) and Legendary Resistance. The reaction is a separate action that creates an effect on the reactor, so it cannot add damage to the attack. | A new pause. Contract change. |
| Slot spend on a Feature | Slot spend exists for spells (`characterSpellCast`) and for reactions (the reaction rides in `CHARACTER_MECHANICS_BATCH.reaction`, restored by the attack's undo). No Feature-level "spend a slot of chosen level" cost. | New cost option. Contract change. |

D107 (as cited in the brief) covers hand slots and the off-hand default; it defines no post-attack follow-up offer, and no such offer exists in code today (ATTACK-9.5 two-weapon fighting would build one).

## Proposed design (recommendation, for Phase 8 ruling)

**Option A (recommended): an attacker-side optional rider choice on the existing hold, merged into the same OUTCOME.**

1. **Authoring.** Divine Smite is a `PASSIVE` Feature effect on `MELEE_WEAPON_ATTACK` with `ON_HIT` `DAMAGE` rows, plus a new generic effect option `optionalOnHit: { cost: SPELL_SLOT (any level the actor can pay) }`. Without the option the rider is mandatory (Improved Divine Smite, Sneak Attack). Dice rows are keyed by the bound `spellCastLevel` (2d8 at 1, +1d8 per level, row for 5+ capped at 5d8); the undead/fiend +1d8 is a second damage row gated by a `CREATURE_TYPE` target predicate. Damage type is a literal radiant uuid. Nothing names Divine Smite.
2. **Pause.** After TEST hits (and before OUTCOME), if the attacker holds any `optionalOnHit` rider it can pay for, the occurrence holds with `applicationContext.onHitChoice` (a sibling of `reactionChoice`, same choice-graph machinery `startReactionChoice`). The roller is the attacker, so its controller answers (D19). Options: one per affordable slot level, plus decline. Pin: rider effect id, slot level, slot-pool version, target state checksum (the target's HP is not part of it).
3. **Settlement.** A chosen option binds `spellCastLevel` and merges the rider outcomes into the weapon's compiled `ON_HIT` effect through the T2a merge path, so crit doubling and resistance need no new code. The slot spend rides in the attack's `CHARACTER_MECHANICS_BATCH` (as the reaction does), so the existing action undo restores it. A replayed command derives the same ids.
4. **Why not a separate follow-up action** (Option B): damage applied as a second instance would resist and round separately from the weapon damage, would need a pin carrying "was a critical", and would double the commits and undo children. Rejected.

## Questions for Phase 8 (contract changes; blocking)

1. Approve Option A: a new pending `onHitChoice` phase on the `ENCOUNTER_ACTION` occurrence (new persisted pending shape, `encounterActionPending.ts`, `actionPendingPersistence.ts`, the pending summary and the decision drawer), generalizing rather than copying `reactionChoice`? Or generalize `reactionChoice` itself into one "interstitial choice" offer with a `chooser` of `TARGET` or `ATTACKER`?
2. Approve the generic `optionalOnHit` cost option (slot of a chosen level, payable by the actor) on a Feature effect, and the target-creature-type condition on a damage row? Or does the ATTACK-9 session (T2b predicates) already own a damage-row condition shape I should reuse?
3. Sequencing: T4 depends on T2a (rider merge) being on the phase branch. May I merge `ci/attack-9-t2a` into my branch now, or wait for Phase 8 to merge it?

## Red-first checklist (after the ruling)

1. Journey through the real Encounter path (Worker): Paladin hits, is offered the choice, spends a 2nd-level slot, gets 3d8 radiant (4d8 against a fiend), doubled on a crit; the slot is spent; GM undo restores the slot and the damage.
2. Unit: 5th-level slot caps at 5d8 (and a 6th-level slot also 5d8); decline spends nothing; ranged hit and spell attack get no offer; no slot, no offer; Improved Divine Smite adds 1d8 on every melee hit (no choice) and stacks with Smite on a crit (doubled); resisted radiant.
3. Authoring parity: SRD Paladin Features versus an author-built equivalent through the real form (`apps/web/src/forms/tests/AuthoredDomainFieldParity.test.tsx` pattern): same published structure, same resolution.
4. SRD: replace both `closedRuleEffect`s; drop `CLASS_PALADIN_DIVINE_SMITE` and `CLASS_PALADIN_IMPROVED_DIVINE_SMITE` from `closedRuleKind.ts`.

## Status log

- 2026-10-15: survey done; plan written; questions sent to Phase 8. Waiting for the ruling.
- 2026-10-15: D123 answers received (Option A; `onHitChoice` is a third sibling offer, generic over attacker on-hit options; `optionalOnHit` cost is a spell slot with a level choice or a resource-pool use; creature type is a T2b predicate, added after T2b merges; Improved Divine Smite is a mandatory D119(a) rider). Design below settled; building.

## Settled runtime shape (D123)

- **Authoring.** `optionalOnHit` is a field of a `PASSIVE` weapon-attack invocation: `{ kind: 'SPELL_SLOT' }` (the `RESOURCE_POOL` cost was dropped: nothing needs it and only the slot exists in the cost model). Nothing else marks a rider optional. The rider's damage rows are keyed by `SPELL_CAST_LEVEL` (D118), so the level the player picks selects the row.
- **Merge.** `collectOnHitRiders` carries the rider's effect id and `optionalOnHit`; `mergeOnHitRiders` appends an optional rider's entries to the weapon's compiled effect through the same path, stamped `optionalRider: { riderId, cost }`. They stay in `compiledEffect`, so TEST, `compilerSourceChecksum` and the plan are stable whether or not the rider is chosen.
- **Selection.** The OUTCOME specialization drops every entry stamped `optionalRider` unless its `riderId` is in the bound fact `dnd5e.selected-optional-riders`; the cast level rides in the existing `dnd5e.spell-cast-level` fact. The Sheet's action card (`normalizeCharacterActionMechanicFacts`) never lists an optional rider.
- **Pause.** After a hit (and after any `reactionChoice` resolves) the attacker's riders it can pay for hold the occurrence with `applicationContext.onHitChoice`, mirroring `reactionChoice`: choice graph via `startReactionChoice`, a pin, an audit in the OUTCOME `twoPhase`. A choice rebuilds the TEST under an adjusted binding (`reconstructNativeActionTest` without `execution`), as a used reaction does, then `continueNativeActionAfterTest` with the audit.
- **Spend.** The slot or pool use rides in the attack's own `CHARACTER_MECHANICS_BATCH`, so GM undo restores it.

## Increments

- I1: authoring option, merge, OUTCOME selection, core-option Divine Smite fixture (rules-runtime proofs: chosen versus not, 2nd-level slot 3d8, cap 5d8, crit doubling, resistance).
- I2: `onHitChoice` pause (schema, runtime, persistence, Worker), slot/pool spend and undo; Worker journey.
- I3: SRD Paladin Features from core options, closed-rule kinds deleted, authoring parity test, Improved Divine Smite.
- I4: decision drawer, docs, creature-type predicate after T2b merges.

## Status

- I1-I3 built and pushed to `ci/attack-9-t4`: authoring option, merge, selection, `onHitChoice` pause across schema/runtime/persistence/Worker/drawer, SRD Paladin Features from core options (creature-type restriction added to the D119 roll-time checks via `dnd5e.target-creature-type`), closed-rule kinds deleted.
- Proofs: `rules-runtime/src/__tests__/srdDivineSmite.test.ts` (variants: cap 5d8, undead/fiend, crit, ranged, Improved), `encounterOnHitChoice.test.ts`, `characterOptionalOnHitRiders.test.ts`, `attackRestrictions.test.ts`; Worker `nativeRoomOnHitChoice.test.ts` (offer, 3d8, crit, decline, slot spend, GM undo, SRD ghoul); web `AuthoredDomainFieldParity.test.tsx` (SRD Divine Smite features versus the real form).
- Not covered: a Shield-then-Smite chain in one Worker room (the room fixture supports one Character; the ordering is `reactionChoice` first, enforced by mutual exclusion in the pending schema and by `nativeEncounterRules`). Recorded as a risk.
