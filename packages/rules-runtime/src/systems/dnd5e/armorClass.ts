import {
  EQUIPMENT_PROPERTY_CODE,
  resolveHandOccupancy,
  type EquipmentSlotCode
} from '@artificer-toolkit/shared/core'
import type { CompiledEquipment } from '@artificer-toolkit/shared/subjects/compilers'

import { abilityModifier, resolveAbilityModifierBonus } from './abilityModifier.js'
import { characterPolicyRecord } from './characterPolicyValues.js'

/**
 * The one D&D armor class formula. The standard base is worn armor (its armor class plus the
 * ability bonuses it grants itself, such as light armor's Dexterity) or 10 + Dexterity unarmored.
 * Authored alternatives ("your AC equals 13 + DEX") compete with it and never stack: the best one
 * wins. A shield and flat bonuses then add.
 */
export function combineDnd5eArmorClass(input: {
  armor: { armorClass: number; abilityBonuses: readonly number[] } | null
  dexterityModifier: number
  setValues: readonly number[]
  shield: number
  additive: readonly number[]
}): { base: number; effective: number } {
  const standardBase =
    input.armor === null
      ? 10 + input.dexterityModifier
      : input.armor.abilityBonuses.reduce((sum, bonus) => sum + bonus, input.armor.armorClass)
  const base = Math.max(standardBase, ...input.setValues) + input.shield
  return { base, effective: input.additive.reduce((sum, value) => sum + value, base) }
}

/**
 * The one shield D&D armor class counts of those held in a hand (D107): the one that adds the most
 * (`addsOf`), the main hand's on a tie.
 */
export function selectDnd5eHeldShield<Shield>(
  held: readonly { inMainHand: boolean; shield: Shield }[],
  addsOf: (shield: Shield) => number
): Shield | null {
  const best = held.reduce<(typeof held)[number] | undefined>((chosen, candidate) => {
    if (chosen === undefined) return candidate
    const difference = addsOf(candidate.shield) - addsOf(chosen.shield)
    return difference > 0 || (difference === 0 && candidate.inMainHand) ? candidate : chosen
  }, undefined)
  return best?.shield ?? null
}

export type CreatureArmorClassEquipment = {
  id: string
  useState: EquipmentSlotCode
  compiled: CompiledEquipment
}

export type Dnd5eArmorClassResult =
  | { ok: true; armorClass: number }
  | { ok: false; equipmentId: string; reason: string }

type ItemModifiers =
  | { ok: true; abilityBonuses: number[]; flatBonuses: number[] }
  | Extract<Dnd5eArmorClassResult, { ok: false }>

/**
 * An armor or shield's authored armor class, for Characters and Creatures alike (D143): one
 * without it is refused, never given a default.
 */
export function resolveDnd5eEquipmentArmorClass(
  equipmentId: string,
  armorClass: number | null | undefined
): Dnd5eArmorClassResult {
  return armorClass == null
    ? {
        ok: false,
        equipmentId,
        reason: `Equipment "${equipmentId}" is armor or a shield without an armor class.`
      }
    : { ok: true, armorClass }
}

function failure(equipmentId: string, reason: string): ItemModifiers {
  return { ok: false, equipmentId, reason }
}

/**
 * A Creature has no restriction evaluator, so only the SRD while-equipped restriction is
 * understood: one group and context whose single condition is "this source is equipped".
 * Placement in a worn or hand slot is what equipping means for a Creature.
 */
function isWhileEquippedRestriction(restrictions: unknown): boolean {
  const groups = characterPolicyRecord(restrictions).groups
  const contexts =
    Array.isArray(groups) && groups.length === 1 ? characterPolicyRecord(groups[0]).contexts : null
  const conditions =
    Array.isArray(contexts) && contexts.length === 1
      ? characterPolicyRecord(contexts[0]).conditions
      : null
  const [condition] = Array.isArray(conditions) && conditions.length === 1 ? conditions : []
  const { kind, constraint, predicateCode } = characterPolicyRecord(condition)
  return (
    kind === 'PREDICATE' && constraint === 'INCLUDE' && predicateCode === 'WHILE_SOURCE_EQUIPPED'
  )
}

/** The ability bonuses and flat bonuses an armor or shield item grants itself, or why not. */
function itemArmorClassModifiers(
  item: CompiledEquipment,
  dexterityModifier: number
): ItemModifiers {
  const abilityBonuses: number[] = []
  const flatBonuses: number[] = []
  for (const modifier of item.modifiers ?? []) {
    if (modifier.valueDomainCode !== 'ARMOR_CLASS') continue
    if (!isWhileEquippedRestriction(modifier.restrictions))
      return failure(
        item.id,
        `Equipment "${item.id}" has an armor class modifier that is not the while-equipped form, which a Creature cannot evaluate.`
      )
    const { payload } = modifier
    if (
      modifier.modifierKind === 'ABILITY_MODIFIER_BONUS' &&
      payload !== undefined &&
      'ability' in payload &&
      payload.ability === 'DEXTERITY'
    ) {
      abilityBonuses.push(resolveAbilityModifierBonus(dexterityModifier, payload))
    } else if (
      modifier.modifierKind === 'BONUS' &&
      payload !== undefined &&
      'valueKind' in payload &&
      payload.valueKind === 'FIXED'
    ) {
      flatBonuses.push(payload.amount)
    } else {
      return failure(
        item.id,
        `Equipment "${item.id}" has an armor class modifier a Creature cannot evaluate.`
      )
    }
  }
  return { ok: true, abilityBonuses, flatBonuses }
}

/**
 * A Creature's armor class from its effective loadout (D107): worn armor, one shield held in a
 * hand, and its natural armor bonus. A shield that is only carried or worn counts for nothing.
 * Equipment a Creature cannot evaluate yields a failure the caller decides on. Active-effect
 * grants are added by the consumers, not here.
 */
export function resolveDnd5eCreatureArmorClass(input: {
  dexterityScore: number
  naturalArmorBonus: number
  equipment: readonly CreatureArmorClassEquipment[]
}): Dnd5eArmorClassResult {
  const dexterityModifier = abilityModifier(input.dexterityScore)
  const wornArmor = input.equipment.find(
    (entry) => entry.useState === 'WORN' && entry.compiled.category === 'ARMOR'
  )
  const occupancy = resolveHandOccupancy(
    input.equipment.map((entry) => ({
      id: entry.id,
      slot: entry.useState,
      twoHanded: entry.compiled.properties.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED)
    }))
  )

  let armor: { armorClass: number; abilityBonuses: readonly number[] } | null = null
  let flatBonuses: readonly number[] = []
  if (wornArmor) {
    const modifiers = itemArmorClassModifiers(wornArmor.compiled, dexterityModifier)
    if (!modifiers.ok) return modifiers
    const base = resolveDnd5eEquipmentArmorClass(
      wornArmor.compiled.id,
      wornArmor.compiled.armorClass
    )
    if (!base.ok) return base
    armor = { armorClass: base.armorClass, abilityBonuses: modifiers.abilityBonuses }
    flatBonuses = modifiers.flatBonuses
  }
  const heldShields: { inMainHand: boolean; shield: number }[] = []
  for (const [inMainHand, id] of [
    [true, occupancy.mainHandId],
    [false, occupancy.offHandId]
  ] as const) {
    const shield = input.equipment.find((entry) => entry.id === id)
    if (shield?.compiled.category !== 'SHIELD') continue
    const modifiers = itemArmorClassModifiers(shield.compiled, dexterityModifier)
    if (!modifiers.ok) return modifiers
    const base = resolveDnd5eEquipmentArmorClass(shield.compiled.id, shield.compiled.armorClass)
    if (!base.ok) return base
    heldShields.push({
      inMainHand,
      shield: [...modifiers.abilityBonuses, ...modifiers.flatBonuses].reduce(
        (sum, value) => sum + value,
        base.armorClass
      )
    })
  }
  const shieldBonus = selectDnd5eHeldShield(heldShields, (bonus) => bonus) ?? 0
  return {
    ok: true,
    armorClass: combineDnd5eArmorClass({
      armor,
      dexterityModifier,
      setValues: [],
      shield: shieldBonus,
      additive: [input.naturalArmorBonus, ...flatBonuses]
    }).effective
  }
}

/** For consumers that must not continue with Equipment the armor class cannot evaluate. */
export function requireDnd5eArmorClass(result: Dnd5eArmorClassResult): number {
  if (!result.ok) throw new Error(result.reason)
  return result.armorClass
}
