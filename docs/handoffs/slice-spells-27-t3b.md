# Slice SPELLS-27.T3b: every cast ends cast-ended effects

Status: DONE (workbook session SPELLS-8.T1), green on `ci/spells-27-t3b`.

Scope: part of AC SPELLS-27.1. Character reactor casts (Shield, Counterspell as reactor) and Creature and Legendary casts raise ON_CAST_SPELL and end the caster's own cast-ended effects. Proofs: an area cast that catches its own invisible caster, replay after a declined Counterspell offer, a cantrip whose only Sheet change is the release. The authoring-parity test asserts an invalid end event is cleared.

Branch: `ci/spells-27-t3b`, based on `ci/merge-batch-ae`. Parent: [slice-spells-27-t3.md](slice-spells-27-t3.md). Decision: `D-pending-spells-27-t3b` (none yet; Phase 8 assigns the number).

## What changed

- **One cast fact for every caster.** `preparedCastsSpell(prepared)` (`encounterCastReactionDiscovery.ts`) is true for a Character's spell or cantrip cast (`preparedSpellCastLevel` non-null) and for a Creature or Legendary action whose invocation trigger is a melee or ranged spell attack. Every `actionEndedEffects({ castsSpell })` call site reads it: single-target action and reaction (`nativeEncounterRules.ts`), area cast (`nativeEncounterAreaRules.ts`), movement reaction (`reactionAttackRollEnd`), Legendary window (`encounterTurnLegendaryAction.ts`). Counter levels (`preparedSpellCastLevel`) stay Character-only.
- **Shield-style reactor.** The reactor is the host action's target Character, so its releases ride the host's target batch (`targetReleases` on `NativeEncounterActionMechanicsInput`, applied after the host source's own releases and before the outcome). Its consumed grants join the host's `consumedGrants`, minus any the host already ended. Undo uses the existing target-side restore.
- **Counterspell reactor.** `planNativeCounteredCast` takes `reactorEffects` and ends the reactor's cast-ended effects with the reactor's own spend. `EncounterCounteredCastReceiptDto` gains a required `applications` (the reactor's released conditions); its stream version is present when a slot was spent or a condition released. `counteredCastCommitPersistence.ts` applies and checksum-verifies them; `actionRevert.ts` restores them with the reactor's slot.

## Proofs

- Unit: `encounterCastReactionDiscovery.test.ts` ("prepared action casts a spell").
- Convex: `actionSpellCasting.test.ts` Invisibility describe: a cantrip with no slot ends the effect, condition and Concentration, and a GM undo restores them; the authoring-parity test asserts an unlisted end event is cleared by the real `spell` node map.
- Worker rooms: `nativeRoomReaction.test.ts` (Shield ends the reactor's own cast-ended effect and condition, one undo restores both), `nativeRoomCounterspell.test.ts` (a Counterspell holder's grant ends on counter, one undo restores; replay of a declined offer ends the grant once and leaves the Run unchanged), `nativeRoomSpellCasting.test.ts` (a point-area cast catches its own invisible caster), `nativeRoomLegendary.test.ts` and `nativeRoomGrantEnds.test.ts` (a spell-attack Legendary option and opportunity attack end the grant and release its condition; a weapon attack keeps it).

## Disclosures

- Judgment call: a Creature "casts a spell" when its action's trigger is a melee or ranged spell attack. Creature authoring has no other spell marker; the definition lives in one function and is cheap to revise.
- Counter levels stay Character-only: only a Character's spell can be countered by level (`preparedSpellCastLevel`).
- Schema contract change: `counter.applications` is required on the countered-cast receipt. Pre-launch, no shim.
- Not handled: a reactor cast that starts Concentration and replaces an existing one; the Disarm and turn-resource paths are not casts.

- Reviewer finding fixed: the Legendary commit recomputed the owner's ended effects without the cast fact, so a cast-only grant would have been released by the plan and rejected as stale. The Legendary evidence gains a required `castsSpell` beside `attackRoll`, and `turnResourcesPersistence.ts` reads it.
- Reviewer finding deferred (`future-enhancements.md` "Deferred edge cases"): a cast that ends the caster's Concentration in the same command that damages that Concentration (Shield while hit, or the caster in its own damaging area; the latter dates from T3) fails the commit. Rare and recoverable.
- Reviewer finding, stands: a Creature's non-attack spellcasting (save-based or activated triggers) does not raise the fact; there is no authored spell marker to read.

## Log

- Red run on `ci/spells-27-t3b-red` (`a41282184`): Tests 38905397540 failed (typecheck: missing `preparedCastsSpell`; the nine `preparedCastsSpell` unit tests; the strengthened parity test); Live backend 38905397838 green (tests only). Several room proofs (area-catches-caster, declined replay, cantrip) cover paths T3 already handled and pass before the fix.
- Green attempt 1 on `995f80db9`: Tests 38907163874 failed. Typecheck `cast.reactor` possibly undefined (a COUNTERED cast carries `found`, not `reactor`), which threw in the four Counterspell room tests; and my parity assertion compared the cleaned effects with a variant built by another call (fresh ids). Fixed in `01580d020`.
- Green on `01580d020`: Tests 38909640064, Live backend 38909640413.
- Independent opus review: one HIGH fixed (Legendary evidence `castsSpell`), one HIGH deferred, one MEDIUM stands (see Disclosures).
