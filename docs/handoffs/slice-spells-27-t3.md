# Workbook: SPELLS-27.T3 a spell cast ends the effects that end on a cast

**Status:** code and tests written; CI on `ci/spells-27-t3` decides. Branch `spells-27-t3`, based on `ci/merge-batch-z` with `ci/spells-27-t2b` merged in. Parent: [slice-spells-27.md](slice-spells-27.md) (task table, section 7).

Closes AC SPELLS-27.1 (the cast half). Decision: `D-pending-spells-27-t3` (none yet; Phase 8 assigns the number).

## What changed

- **One consumer for the cast fact.** `effectsEndedBy(effects, ...events)` takes several events and ends an effect once even when it lists more than one. `actionEndedEffects({ holderActorId, held, makesAttackRoll, castsSpell })` replaces `attackRollEndedEffects` in every caller (action, movement reaction, Legendary window, Disarm, turn resources).
- **The fact is raised once per commit kind, at the commit path, from the prepared cast.** `preparedSpellCastLevel(prepared)` is non-null only for a Character's spell cast, so `castsSpell` is true exactly then.
  - Single-target action and reaction cast: `planNativeEncounterActionMechanics`. The release goes first on the target batch when the caster is the target (the planner no longer throws), else on the source batch.
  - Area and chosen-creature cast: the area root gains required `sourceApplications` and its commit input `consumedGrants`. The release rides the root's source batch, or the caster's child batch when the caster is caught in the area.
  - Countered cast: `ENCOUNTER_COUNTERED_CAST` gains the same two fields; a countered cast still uses up the caster's cast-ending effects (`makesAttackRoll: false`, `castsSpell: true`).
- **Undo.** `actionRevert.ts` gives back the conditions an ended effect released (`restoreReleasedConditions`, source and target side), from the root's `sourceApplications` or the child's own applications; a `CONDITION_REMOVE` with the ended-effect operation key is no longer "unsupported".

## Proofs

- Rules-runtime unit: `encounterEndedEffectRelease.test.ts` (cast describe), `grantLifetimes.test.ts` (multi-event, one end per effect).
- Journey (Convex, real room): `actionSpellCasting.test.ts` Invisibility describe. Cast Invisibility, cast Cure Wounds on another creature and on the caster: effect, condition and Concentration end; a GM undo gives all three back.
- Authoring parity (ADR 0038 decision 1): same describe. The SRD record and an author's variant (own id and label, `endOnEvents: ['ON_CAST_SPELL']`) pass the real `spell` node map unchanged (`clearedPaths` empty, effects equal), and the variant ends on a cast as the SRD does.
- Worker rooms: `nativeRoomChosenActorsSpell.test.ts` (list cast ends the caster's cast-ending grant, one undo returns it) and `nativeRoomCounterspell.test.ts` (a countered cast still ends it, one undo returns it).

## Disclosures

- Schema contract change: `sourceApplications` is required on the area and countered roots (`sourceSpendReceiptShape`), and `consumedGrants` on their commit inputs. Pre-launch, no shim; development receipts that fail the new field take the approved local reset.
- Creature and Legendary casts do not raise `ON_CAST_SPELL` (`preparedSpellCastLevel` is Character-only). No SRD creature effect lists the event today.
- Pre-existing, unchanged: an area ray's grant that ends only on `ON_ATTACK_ROLL` is not consumed (area casts are covered by `ON_CAST_SPELL`).
- T6 still unifies `consumeOnFirstEvents` and `endOnEvents`; `effectsEndedBy` reads both.
