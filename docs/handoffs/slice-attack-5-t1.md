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
