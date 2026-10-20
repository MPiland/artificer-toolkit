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
