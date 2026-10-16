# Slice ATTACK-9.T5: Two-weapon fighting

Status: IN_PROGRESS (workbook session ATTACK-9.T1). Branch: `ci/attack-9-t5`, based on `ci/merge-batch-ad` (c718dedeb).

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

Closes AC ATTACK-9.5: after an Attack action with a light melee weapon, the actor is offered the off-hand light weapon attack as a bonus action (D107). It adds no positive ability modifier to damage unless the actor has the Two-Weapon Fighting style. The feature is authored only from core authoring options (no `CLOSED_RULE`, no feature-specific kind or executor); an author-built equivalent made through the real authoring form publishes to the same structure and resolves identically.

Split by Phase 8 (each part gets a red CI run first):

- **T5a**: the compiler accepts `BONUS_ACTION` weapon attacks; the stored `ATTACK_ACTION` per-attack record carries the attacking item and its property codes; one generic requirement predicate on item effects.
- **T5b**: a generic ability-modifier damage mode "negative only" (contributes `min(modifier, 0)`), selectable in data on the bonus-action effect; the Two-Weapon Fighting style (Fighter, Ranger, Champion) as a core grant that restores the full modifier for that effect.
- **T5c**: light melee weapon builders gain a second `BONUS_ACTION` effect (the per-weapon property-builder pattern, like finesse); the equipment form can author the same; journey test; SRD plus homebrew authored parity. Regenerate the SRD manifest from the Live artifact, not locally.

## D-pending-attack-9-t5 (Phase 8 ruling, 2026-10-16; SRD 5.1 `SRD_CC_v5.1.txt:5351`)

SRD: "...attack with a different light melee weapon that you're holding in the other hand. You don't add your ability modifier to the damage of the bonus attack, unless that modifier is negative."

- (a) The compiler accepts `BONUS_ACTION` weapon attacks (approved, internal).
- (b) A hand `slot` in the transport is REJECTED: "different item" already means the other hand, and a slot predicate would wrongly refuse a swing made with the off-hand weapon.
- (c) The stored `ATTACK_ACTION` per-attack record is widened with the attacking item's id and its property codes. ONE generic requirement predicate: "took the Attack action this turn with a weapon having properties P, other than this item". Authorable from core options.
- (c, damage) A generic ability-modifier damage mode "negative only" selectable in data on the bonus-action effect; the Two-Weapon Fighting style (Fighter, Ranger, Champion) is a core grant restoring the full modifier for that effect. A negative-multiplier idea is rejected.
- (d) LIGHT melee weapon builders gain a second `BONUS_ACTION` effect; the equipment form must be able to author the same (parity proof).

## Design (T5a, implementer choices inside the ruling)

- **Carrier.** The requirement is an optional `requirements` facet on the equipment effect, beside `grip` (`EquipmentEffectAuthored`, `CompiledEquipmentEffectGroup`, the equipment transport schema, and the candidate's `equipment` state). The requirement is relative to "this item", so it belongs to item effects; non-item effects can adopt it later (not needed now).
- **Predicate.** One new facet predicate (CHARACTER subject, holder-state like `FREE_HAND`), parameterised with the equipment property codes (and optional category). Evaluated by one pure function over the open Attack action record and the acting item; never over the Sheet-level availability policy, which cannot see Encounter state.
- **Record.** `attacks[].item?: { itemInstanceId, properties[] }`, written by the worker from the candidate's equipment. Only ACTION attacks fill the record; a `BONUS_ACTION` attack is untracked and spends the bonus-action allowance.
- **Offer and refusal.** `actionChoiceReads.ts` hides an action whose requirement fails; the worker refuses with `SOURCE_REQUIREMENTS_NOT_MET` (the basic-action restriction pattern).

## Design (T5b, implementer choices inside the ruling)

- **Negative-only is the existing clamp.** `resolveAbilityModifierBonus` already clamps `modifier * multiplier` to the payload's `min`/`max`, so "negative only" is `max: 0` and "restore" is `min: 0`; no new mode or enum. The one gap was the optional (finesse) kind, whose payload had only `abilities`: it gains optional `min`/`max` (core type, schema, resolver, form fields), so a finesse weapon's damage grant can be clamped the same way.
- **Scoping predicate.** A bonus attack needs its damage grants to differ by activation, so one generic EQUIPMENT-context predicate `ATTACK_ACTIVATION` (payload `activation`) joins `ATTACK_ABILITY`. It folds to the restriction condition `ITEM_ACTIVATION` (reusing `requiredIds`), and `Dnd5eModifierTarget` carries the action's `activation` (read from the candidate's invocation). Like `ATTACK_ABILITY`, it needs no item.
- **Weapon grants (authored in T5c).** A Light weapon's damage grant is EXCLUDE-gated on `BONUS_ACTION`; a copy clamped `max: 0` is INCLUDE-gated. The Action attack keeps the full modifier; the bonus attack gets it only while negative.
- **Style.** Two-Weapon Fighting is a core grant, not a closed rule: per ability (Strength, Dexterity) a GLOBAL melee-damage `ABILITY_MODIFIER_BONUS` with `min: 0`, gated on LIGHT + `ATTACK_ACTIVATION` BONUS_ACTION + `ATTACK_ABILITY` = that ability, so the restored modifier follows the ability the attack uses. Fighter, Ranger and Champion share `twoWeaponFightingGrants`; the three `CLASS_*TWO_WEAPON*` closed rule kinds are deleted.

## Design (T5c, implementer choices inside the ruling)

- **Builders are generic transforms.** `withOffHandAttack(childId, effects)` clones the weapon's melee attack as a `BONUS_ACTION` effect carrying the `ATTACK_ACTION_OTHER_WEAPON` (`LIGHT`, `MELEE`) requirement; `withOffHandDamage(childId, modifiers)` splits each melee damage ability-modifier grant into the Action grant (EXCLUDE `ATTACK_ACTIVATION` BONUS_ACTION) and a `max: 0` copy (INCLUDE). Both are in `dnd5eEquipmentBuilders.ts`, so the SRD (via `srdChildId`) and any import share them; the seven SRD Light melee weapons apply them. Nodes of the clone take ids from fresh buckets (`0x240` effect nodes, `0x250` requirement, `0x260/0x261` activation context, `0x270` damage clone).
- **Form.** `EQUIPMENT_EFFECT_NODE_MAP` gains `requirements` (the same character facet editor as item `restrictions`), so an author can build the identical effect; the parity proof publishes the SRD Club, Shortsword and Dagger and the Fighter through `normalizeNodeRuntimeValues` and requires an equal document with nothing cleared.
- **Choices name the activation.** Item attack choices now carry `actionCost` (it was spell-only), so the Action and the off-hand attack of one weapon are told apart in the offer, and the drawer shows the cost.
- **Not done.** The homebrew import path (`importedWeaponAttack.ts`, `importedEquipmentTerms.ts`) still builds only the Action attack; routing a Light melee import through the same two builders is a follow-up.

## Log

- T5a started. Red tests first, pushed to a `ci/attack-9-t5a-red` branch; run ids recorded below.
- T5a red: Tests 38905082156 on `ci/attack-9-t5a-red` @07affe3dc failed on the three intended files (bonus-action compile, requirement module missing, attack record item).
- T5a green: Tests 38918177360 and Live backend 38918177250 on `ci/attack-9-t5` @bd973edd4 (merged with `ci/merge-batch-ai`).
- T5b started (base 2e1b67be5). Red tests first: `twoWeaponFightingDamage.test.ts`.
- T5b red: Tests 38923270291 on `ci/attack-9-t5b-red` @7f52b3fae failed on the new file (five damage assertions, plus two typing errors in the test's own authoring that the implementation commit fixes).
- T5b green: Tests 38927082342 and Live backend 38927082404 on `ci/attack-9-t5` @864f57a1f (SRD manifest regenerated from the Live `generated-files` artifact). T5b DONE; T5c next.
- T5c started. Red tests first: `offHandAttack.test.ts` (source-data), `twoWeaponFightingDamage.test.ts` (rules-runtime, real SRD weapons), `offHandAttackAuthoringParity.test.ts` (authoring), `nativeRoomTwoWeaponFighting.test.ts` (journey).
- T5c red: Tests 38931895848 on `ci/attack-9-t5c-red` @2a6d99876 failed on `offHandAttack.test.ts` (15 assertions: no bonus effect, no split damage grants); the step stops there, so the other three files first run in the green push.
