# Slice SPELLS-27.T3: effects that end on a spell cast

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

Closes SPELLS-27.1 with T2b. An ON_CAST_SPELL fact emitted from the one shared cast-commit path feeds the end-trigger consumer; Invisibility ends when its holder casts a spell; an author-built equivalent made through the real authoring form publishes to the same structure and ends the same way (ADR 0038). SPELLS-27.T2b (platform-13-t5 session) works in the same feature; merge it once it lands.

Iterate in CI (`ci/spells-27-t3`). Parent: [slice-spells-27.md](slice-spells-27.md) (task table, section 7). Branch `spells-27-t3`, with `ci/spells-27-t2b` merged in. Decision: `D-pending-spells-27-t3` (none yet; Phase 8 assigns the number).

## What changed

- **One consumer for the cast fact.** `effectsEndedBy(effects, ...events)` takes several events and ends an effect once even when it lists more than one. `actionEndedEffects({ holderActorId, held, makesAttackRoll, castsSpell })` replaces `attackRollEndedEffects` in every caller (action, movement reaction, Legendary window, Disarm, turn resources).
- **The fact is raised at each commit path, from the prepared cast.** `preparedSpellCastLevel(prepared)` is non-null only for a Character's spell cast, so `castsSpell` is true exactly then.
  - Single-target action and reaction cast: `planNativeEncounterActionMechanics`. The release goes first on the target batch when the caster is the target (the planner no longer throws), else on the source batch.
  - Area and chosen-creature cast: the area root gains required `sourceApplications` and its commit input `consumedGrants`. The release rides the root's source batch, or the caster's child batch when the caster is caught in the area.
  - Countered cast: `ENCOUNTER_COUNTERED_CAST` gains the same two fields; a countered cast still uses up the caster's cast-ending effects (`makesAttackRoll: false`, `castsSpell: true`).
- **Undo.** `actionRevert.ts` gives back the conditions an ended effect released (`restoreReleasedConditions`, source and target side), from the root's `sourceApplications` or the child's own applications; a `CONDITION_REMOVE` with the ended-effect operation key is no longer "unsupported".

## Proofs

- Rules-runtime unit: `encounterEndedEffectRelease.test.ts` (cast describe), `grantLifetimes.test.ts` (multi-event, one end per effect).
- Journey (Convex, real room): `actionSpellCasting.test.ts` Invisibility describe. Cast Invisibility, cast Cure Wounds on another creature and on the caster: effect, condition and Concentration end; a GM undo gives all three back.
- Authoring parity (ADR 0038 decision 1): same describe. The SRD record and an author's variant (own id and label, `endOnEvents: ['ON_CAST_SPELL']`) pass the real `spell` node map unchanged (`clearedPaths` empty, effects equal), and the variant ends on a cast as the SRD does.
- Concentration collision (reviewer finding): casting a second Concentration spell while the first Concentration is an Invisibility used to end the Invisibility effect twice (cast trigger and the replaced-Concentration maintenance), and `deleteCas` threw. `planNativeLiveEncounterAction` now computes the ended effects after the maintenance and leaves out the effects it removes. Regression: `actionSpellCasting.test.ts` "ends once when the cast is another Concentration spell, and a GM undo gives the Invisibility back".
- Worker rooms: `nativeRoomChosenActorsSpell.test.ts` (list cast, and list cast with the caster among the chosen creatures) and `nativeRoomCounterspell.test.ts` (countered cast, and declined then resolved). Each seeds the grant with an owned Invisible condition on the Character's Sheet and checks the condition is released and one undo restores grant and condition, so the `sourceApplications` persistence and revert branches run.

## Disclosures

- Schema contract change: `sourceApplications` is required on the area and countered roots (`sourceSpendReceiptShape`), and `consumedGrants` on their commit inputs. Pre-launch, no shim; development receipts that fail the new field take the approved local reset.
- Creature and Legendary casts do not raise `ON_CAST_SPELL` (`preparedSpellCastLevel` is Character-only). No SRD creature effect lists the event today.
- Pre-existing, unchanged: an area ray's grant that ends only on `ON_ATTACK_ROLL` is not consumed (area casts are covered by `ON_CAST_SPELL`).
- Not covered, proposed as a follow-up: a Character's _reactor_ casts. A Shield (or Counterspell) cast as the reaction to another creature's action, spent through `reactionUse` / the countered cast's `reactorSpend`, does not raise `ON_CAST_SPELL` for the reactor, so an invisible Character who reacts with Shield stays invisible. It needs the reactor's own releases and consumed grants carried on the host action's contract and undone with it. The cast reaction this slice covers is the Character's own cast (action, area, list, countered).
- T6 still unifies `consumeOnFirstEvents` and `endOnEvents`; `effectsEndedBy` reads both.

## Log

- No local red logs: free memory (about 0.3 GB) blocks builds and typechecks, and local vitest reads a stale built `schema` dist. Checkpoints run in CI.
- Process: the early edits in this slice used throwaway Python edit scripts (against the workbook rule "Edit or Write tools only"); the later ones used Edit and Write.
