# ATTACK-5.T1: Balor Whip, Kraken Lightning Storm, Purple Worm Tail Stinger

Status: current. Closes ATTACK-5.2, 5.8 and 5.9. No new option or contract.

| AC  | Attack                   | How it runs                                                                                      | Change                                                           |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 5.2 | Balor Whip               | Hit damage, then a `FOLLOW_UP_SAVE` Strength rider with `FORCED_MOVEMENT` `TOWARD_SOURCE` 25 ft  | None; already authored generically. Proved.                      |
| 5.8 | Kraken Lightning Storm   | One `SAVING_THROW` action over `CHOSEN_CREATURES` (`maxTargets: 3`)                              | Was `SINGLE_TARGET`; now one bolt per chosen creature.           |
| 5.9 | Purple Worm Tail Stinger | Piercing hit, then the shared `constitutionPoisonDamageSave` rider (DC 19, 12d6, half on a save) | The separate save effect is folded into the attack's `SEQUENCE`. |

Proofs: `srdCreatureHitRiders.test.ts` (rules-runtime) and `nativeRoomMonsterRiders.test.ts` (room journeys).

## Known limit

Lightning Storm names each creature once. A repeating save list is refused on purpose (`isSupportedTestTargetPolicy`: a creature named twice would save twice), so the print's "each bolt can strike a target" cannot aim two bolts at one creature. Allowing it needs a ruling on repeated save targets; it is not built.

None of the three was on `SRD_CREATURE_ATTACK_UNSUPPORTED`, so the allowlist does not shrink.

## ATTACK-5.T2 (5.3 to 5.7)

Clay Golem Slam, Cloaker Bite, Dryad Shillelagh club and the enlarged Duergar war pick and javelin already ran from generic options (ACs 8.1: the GM picks the exact option). None was on `SRD_CREATURE_ATTACK_UNSUPPORTED`, so the allowlist is unchanged. T2 only adds proof: `srdCreatureHitRiders.test.ts` (rules-runtime, with an option picker on `prepareCreatureAction`) and `nativeRoomHitRiders.test.ts` (room journeys).

## ATTACK-5.T3 (5.10 to 5.14)

Quasit Claws and Scare, Shadow Strength Drain, Spirit Naga Bite and Rug of Smothering Smother all run from generic options; none was on `SRD_CREATURE_ATTACK_UNSUPPORTED`, so the allowlist is unchanged. One authoring gap: Scare's result block id was `actionId + '__result'`, which is not a UUID, so the repeating-save plan refused it ("unsupported bounded shape"). It now uses a UUID like the Dust Mephit's. The Rug's Smother is size-capped to Medium, so it is proved against a Medium target (a Large Ogre is not a legal target). Proofs: `srdCreatureHitRiders.test.ts` (rules-runtime, with a target picker on `attackOgre`) and `nativeRoomHitRiders.test.ts` (room journeys).

## ATTACK-5.T4a (Ogre Zombie Morningstar)

A Creature Feature now acts through its held Equipment when both are the same kind of attack; the Feature's printed damage type governs, so the Equipment's default type no longer has to match (`actsThroughEquipment` in `encounterFeatureActionCapabilityDiscovery.ts`). The SRD print is untouched. The Ogre Zombie Morningstar left `SRD_CREATURE_ATTACK_UNSUPPORTED`, and the `EQUIPMENT_DAMAGE_TYPE` reason was deleted from the allowlist and the sweep. Proofs: `srdCreatureHitRiders.test.ts` and `nativeRoomHitRiders.test.ts`.

Replacement (orchestrator ruling A): `replaceActorEquipment` still refuses a replacement that changes the damage types of the Equipment a Feature action is bound to (`equipmentReplacementKeepsDamageTypes`), so the print governs the bound attack but the loadout cannot drift to another weapon type. Proofs: `nativeRoomEquipmentReplacement.test.ts` (Ogre Zombie accepts a Shortsword, refuses a Mace); the two existing refusal tests are unchanged.

## ATTACK-5.T4b (Cockatrice Bite, Guardian Naga Spit Poison)

Two generic follow-up-save shapes in `effectActionCompiler.ts`, both authored as data: (1) an immediate save with no damage before it (Spit Poison: `immediateFollowUpSaveEntries` no longer requires a primary damage entry); (2) `ESCALATING_CONDITION`, an immediate save whose failure applies one condition and then a once-only `TARGET_TURN_END` save that, on a failure, ends the current effect with another condition (`escalatingImmediateSave`). It reuses the Gorgon's `DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_CONDITION_FACT_KEY` through the shared `escalationCondition` helper in `repeatingDirectFollowUpSavePlan`; the effect lasts one turn tick, and an authored duration on the escalating form is refused. The Cockatrice print changed only its result-block id (a UUID, as in the Quasit Scare fix). Both entries left the allowlist. Proofs: `srdCreatureHitRiders.test.ts` and `nativeRoomHitRiders.test.ts`; the Gorgon's `nativeRoomSrdBreathEscalation.test.ts` already proves the end-of-turn escalation through the same fact.

Couatl Bite is NOT done and keeps its `FOLLOW_UP_SAVE` entry. Its poison rider carries a CLOSED_RULE (`CREATURE_COUATL_BITE_POISON`, the wake-on-damage action), which SPELLS-33.T6m2 converts; D156 forbids partially executing an Effect with an unconverted closed rule. It also needs a save whose failure applies several conditions. Defer it to T6m2 unless the orchestrator rules otherwise.

## ATTACK-5.T4c (Dragon Turtle Tail)

A fourth generic follow-up-save shape in `effectActionCompiler.ts`: `FORCED_MOVEMENT_THEN_CONDITION`, an immediate save whose failure pushes or pulls and then applies one condition (push and prone). It reuses the existing `nested-save-forced-movement` and `nested-save-condition` graph nodes. The forced-movement proposal now outputs `changesTargetState: false` (it was documented as changing no target state): without it a Character target's mechanics batch demanded an application for the push and the room refused the attack ("application coverage is invalid"). The Dragon Turtle print changed only its result-block id (a UUID, as in the Quasit Scare fix). Its entry left the allowlist. Proofs: `srdCreatureHitRiders.test.ts` (push and prone on a Creature target, pass leaves it standing) and `nativeRoomHitRiders.test.ts` (prone on a Character).

Horned Devil Tail is NOT done and keeps its `FOLLOW_UP_SAVE` entry. Its Infernal Wound carries a CLOSED_RULE (`CREATURE_HORNED_DEVIL_INFERNAL_WOUND`) that SPELLS-33.T6m2 converts (new STACKING_RECURRING_DAMAGE); D156 forbids partially executing an Effect with an unconverted closed rule. The T4 close-out must cover it after T6m2.

## Resume here: ATTACK-5.T4d–e (fresh session, each on its own `ci/attack-5-t4<x>` branch from the phase tip)

Remaining allowlist entries (`packages/rules-runtime/src/__tests__/srdCreatureAttackSweepAllowlist.ts`): remove each attack's entry in the slice that makes it run; the sweep fails if a listed attack starts working or an unlisted one fails.

| Slice | Attacks                                                          | Allowlist reason | Size |
| ----- | ---------------------------------------------------------------- | ---------------- | ---- |
| T4d   | Giant Centipede Bite, Purple Worm Bite (investigate, then build) | `OUTCOME_KIND`   | 3    |
| T4e   | Solar Longbow slay                                               | `OUTCOME_KIND`   | 3    |

T4 itself is then a size-2 close-out: the allowlist is empty (SPELLS-33 tasks T6a1, T6a2, T6a3, T6b2, T6b3, T6e2, T6i, T6i2 remove their own entries; Kraken Bite goes with T6a1, Black Pudding with T6i/T6i2) and leftovers (Rakshasa Claw, Vampire/Spawn Bite if T6e2 misses them) are covered.

File map:

- Creature prints: `packages/source-data/src/srd/creatures/<name>.ts` (protected; fix the compiler or runtime, not the print, except result-block ids as in the Quasit Scare fix).
- Follow-up save planning: `repeatingDirectFollowUpSavePlan` and the plan compilers in `packages/rules-runtime/src/effectActionCompiler.ts`.
- Equipment binding and replacement: `encounterFeatureActionCapabilityDiscovery.ts`, `packages/encounter-persistence/src/actorEquipment.ts`.
- Proof helpers: `srdCreatureHitRiders.test.ts` (`attackOgre`, `target`/`option`), `apps/session-worker/test/nativeRoomHitRiders.test.ts` (`hitRiderRoom`, `settle`, `settledBatch`).

Pitfalls:

- Result blocks the repeating-save plan uses need UUID ids (`S.actionId(...)`); a derived `__result` id reads as "unsupported bounded shape".
- Rolls are 0-based die faces in request order: attack, hit damage, save, then rider dice. In the room the player's save is a separate `settle(room, face)`.
- Smother and similar effects are size-capped; target a Medium actor (e.g. Veteran).
- Tests import workspace packages from `dist`: pass `-BuildFor <test files>` to the light lane.
- A new generic option needing a contract shape goes to the orchestrator before coding.

Couatl Bite (see T4b) and Horned Devil Tail (see T4c) are held for SPELLS-33.T6m2; the T4 close-out must cover them.

Next step: start T4d (Giant Centipede Bite, Purple Worm Bite): probe why each fails in the sweep (`OUTCOME_KIND`), then build the generic option with a rules-runtime test plus a room journey, remove the entries, lint, push to `ci/attack-5-t4d`, run `scripts/watchCi.ps1`. Pitfall: a Character target's mechanics batch needs an application for every authorized candidate proposal, so a new proposal that stores nothing on the target must output `changesTargetState: false`.
