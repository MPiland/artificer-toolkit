# Slice ATTACK-9.T5: Two-weapon fighting

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

## Log

- T5a started. Red tests first, pushed to a `ci/attack-9-t5a-red` branch; run ids recorded below.
