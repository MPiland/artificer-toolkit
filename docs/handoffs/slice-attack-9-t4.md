# Workbook: ATTACK-9.T4 Divine Smite and Improved Divine Smite (AC ATTACK-9.4)

**Status:** survey done 2026-10-15; plan below awaits Phase 8's ruling on the three contract questions. No product code yet.
**Base:** `b51aa4b74` (phase branch `codex/phase-08-2-convex-cutover`). T2a (`ci/attack-9-t2a`, riders) is not merged yet; Improved Divine Smite and the Smite dice depend on it.

## Brief

AC ATTACK-9.4: after a Paladin hits with a melee weapon attack, the player may spend a spell slot to add 2d8 radiant (+1d8 per slot level above 1st, max 5d8; +1d8 against undead or fiends), doubled on a critical hit; Improved Divine Smite adds 1d8 radiant to every melee weapon hit. Authored only from core authoring options; an author-built equivalent made through the real authoring form publishes to the same structure and resolves identically.

Today both Paladin Features (`packages/source-data/src/srd/classes/paladin.ts` ~815 and ~964) are inert `CLOSED_RULE` effects (`CLASS_PALADIN_DIVINE_SMITE`, `CLASS_PALADIN_IMPROVED_DIVINE_SMITE`).

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
