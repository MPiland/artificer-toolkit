# Slice ATTACK-19: Default attack weapon and off-hand damage

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- This session: T1 (AC ATTACK-19.1). The Attack action defaults to the main-hand weapon with full damage, and the bonus attack to the off-hand weapon, which adds no positive ability modifier to damage unless the actor has Two-Weapon Fighting; proficiency applies to both.
- Contracts: [D107](phase-08-2-decisions.md) (hands and the main-hand default). Built on the existing Two-Weapon Fighting closed rules.
- Out of scope: a hand default for initiative declarations and the Sheet Actions tab. The VTT drawer is the play surface.

Base: `origin/codex/phase-08-2-convex-cutover` (`fb395ba06`). CI branch `ci/attack-19-t1`.

## Tasks

| Task | Title                                                                                                      | Closes  | Depends on |
| ---- | ---------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| T1   | Default attack weapon by hand and the off-hand damage rule, reading the existing Two-Weapon Fighting rules | AC 19.1 | none       |

## Findings from reading the code (2026-10-18)

- The off-hand damage rule already exists: `withOffHandDamage` clamps the melee damage ability modifier at `max: 0` for the `BONUS_ACTION` activation, and the Two-Weapon Fighting style restores it for Light weapons (`twoWeaponFightingDamage.test.ts`, `nativeRoomTwoWeaponFighting.test.ts`).
- The off-hand attack (`withOffHandAttack`) is offered only after another Light melee attack this turn (`ATTACK_ACTION_OTHER_WEAPON`).
- The drawer preselected only the open Attack action's last weapon; nothing picked a weapon by hand.

## Progress

- 2026-10-18: T1. `encounterDefaultAttackActionId` (rules-runtime) picks the open Attack action's last weapon, else the main-hand `ACTION` weapon attack, else the off-hand `BONUS_ACTION` weapon attack. `readEncounterActionChoices` reports it as `defaultActionId`, read from the actor's held items (`encounterActorHeldItems`, now exported) and each action's item binding (Character item instance, Creature loadout entry). The tabletop drawer starts on it instead of deriving the last weapon itself. Proofs: `encounterDefaultAttack.test.ts` (rule variants), `nativeRoomTwoWeaponFighting.test.ts` (room journey: main-hand Club default, then the off-hand Shortsword bonus attack with the same attack bonus and no positive damage modifier) and `CampaignTabletopActionDrawer.test.tsx` (the drawer starts on the server default).
