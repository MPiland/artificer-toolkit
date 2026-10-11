import {
  EQUIPMENT_PROPERTY_CODE,
  resolveHandOccupancy,
  type EquipmentSlotCode
} from '@artificer-toolkit/shared/core'
import type { CompiledEquipment } from '@artificer-toolkit/shared/subjects/compilers'

import { abilityModifier, resolveAbilityModifierBonus } from './abilityModifier.js'
import { characterPolicyNumber, characterPolicyRecord } from './characterPolicyValues.js'

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

export type CreatureArmorClassEquipment = {
  id: string
  useState: EquipmentSlotCode
  compiled: CompiledEquipment
}

export type CreatureArmorClassResult =
  | { ok: true; armorClass: number }
  | { ok: false; equipmentId: string; reason: string }

type ItemModifiers =
  | { ok: true; abilityBonuses: number[]; flatBonuses: number[] }
  | Extract<CreatureArmorClassResult, { ok: false }>

function missingArmorClass(equipmentId: string): Extract<CreatureArmorClassResult, { ok: false }> {
  return {
    ok: false,
    equipmentId,
    reason: `Equipment "${equipmentId}" is armor or a shield without an armor class.`
  }
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
    const payload = characterPolicyRecord(modifier.payload)
    if (modifier.modifierKind === 'ABILITY_MODIFIER_BONUS' && payload.ability === 'DEXTERITY') {
      abilityBonuses.push(resolveAbilityModifierBonus(dexterityModifier, payload))
    } else if (modifier.modifierKind === 'BONUS' && payload.valueKind === 'FIXED') {
      flatBonuses.push(characterPolicyNumber(payload.amount))
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
}): CreatureArmorClassResult {
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
  const shield = [occupancy.mainHandId, occupancy.offHandId]
    .map((id) => input.equipment.find((entry) => entry.id === id))
    .find((entry) => entry?.compiled.category === 'SHIELD')

  let armor: { armorClass: number; abilityBonuses: readonly number[] } | null = null
  let flatBonuses: readonly number[] = []
  if (wornArmor) {
    const modifiers = itemArmorClassModifiers(wornArmor.compiled, dexterityModifier)
    if (!modifiers.ok) return modifiers
    if (wornArmor.compiled.armorClass === undefined) return missingArmorClass(wornArmor.compiled.id)
    armor = { armorClass: wornArmor.compiled.armorClass, abilityBonuses: modifiers.abilityBonuses }
    flatBonuses = modifiers.flatBonuses
  }
  let shieldBonus = 0
  if (shield) {
    const modifiers = itemArmorClassModifiers(shield.compiled, dexterityModifier)
    if (!modifiers.ok) return modifiers
    if (shield.compiled.armorClass === undefined) return missingArmorClass(shield.compiled.id)
    shieldBonus = [...modifiers.abilityBonuses, ...modifiers.flatBonuses].reduce(
      (sum, value) => sum + value,
      shield.compiled.armorClass
    )
  }
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

/** For consumers that must not continue with Equipment a Creature cannot evaluate. */
export function requireCreatureArmorClass(result: CreatureArmorClassResult): number {
  if (!result.ok) throw new Error(result.reason)
  return result.armorClass
}
