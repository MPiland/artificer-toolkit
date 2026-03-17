import type { EquipmentAuthored, EquipmentVariantAuthored } from '#authored'
import type {
  AbilityCode,
  EquipmentAttribute,
  EquipmentCategoryCode,
  EquipmentPropertyCode,
  MeasurementUnitCode,
  OperationCode
} from '#core'
import { EQUIPMENT_CATEGORY_CODE } from '#core'
import {
  compileEffect,
  type CompiledEffectGroup,
  compileFeature,
  type CompiledFeature,
  compileModifierGrant,
  type CompiledModifierGrant,
  compileCharge,
  type CompiledCharge
} from '#compilers'

export interface CompiledWeight {
  amount: number
  unit: MeasurementUnitCode
}

/** Capacity limit (used for containers, vehicles, etc.) */
export interface CompiledCapacity {
  amount: number
  unit: MeasurementUnitCode
}

/** Item cost in the system’s currency registry */
export interface CompiledCost {
  amount: number
  currencyId: string
}

/** Nested item container or bundle definition */
export interface CompiledContainsAuthored {
  equipmentId: string
  quantity: number
}

export type CompiledEquipmentAbilitiesAuthored = {
  op: OperationCode
  abilities: { ability: AbilityCode }[]
}

export type CompiledEquipmentBase = {
  id: string
  cost: CompiledCost
  weight: CompiledWeight
  attributes?: EquipmentAttribute[]
  effects?: CompiledEffectGroup[]
  charges?: CompiledCharge
  capacity?: CompiledCapacity
  modifiers?: CompiledModifierGrant[]
  maxStack?: number
  rarityId: string
  maxBonus?: number
  armorClass?: number
  contains?: CompiledContainsAuthored[]
  features?: CompiledFeature[]
}

export type CompiledEquipment = {
  properties: EquipmentPropertyCode[]
  category: Exclude<
    EquipmentCategoryCode,
    typeof EQUIPMENT_CATEGORY_CODE.VARIANT
  >
  abilities: CompiledEquipmentAbilitiesAuthored[]
} & CompiledEquipmentBase

export type CompiledEquipmentVariant = {
  category: typeof EQUIPMENT_CATEGORY_CODE.VARIANT
  parentEquipmentId: string
} & CompiledEquipmentBase

export function compileEquipment(
  authored: EquipmentAuthored | EquipmentVariantAuthored
): CompiledEquipment | CompiledEquipmentVariant {
  const effects
    = authored.effects && authored.effects.length
      ? authored.effects.map(compileEffect)
      : undefined

  const features
    = authored.features && authored.features.length
      ? authored.features.map((feature) => compileFeature(feature as Parameters<typeof compileFeature>[0]))
      : undefined

  const charges = authored.charges ? compileCharge(authored.charges) : undefined

  const modifiers
    = authored.modifiers && authored.modifiers.length
      ? authored.modifiers.map(compileModifierGrant)
      : undefined

  const base: CompiledEquipmentBase = {
    id: authored.id,
    cost: authored.cost,
    weight: authored.weight,
    attributes: authored.attributes,
    capacity: authored.capacity,
    charges,
    effects,
    features,
    rarityId: authored.rarityId,
    maxBonus: authored.maxBonus,
    maxStack: authored.maxStack,
    armorClass: authored.armorClass,
    contains: authored.contains,
    modifiers
  }

  if (authored.category === EQUIPMENT_CATEGORY_CODE.VARIANT) {
    // TypeScript now knows this is EquipmentVariantAuthored
    return {
      ...base,
      category: EQUIPMENT_CATEGORY_CODE.VARIANT,
      parentEquipmentId: authored.parentEquipmentId
    }
  }

  // Otherwise, it's non-variant equipment
  return {
    ...base,
    category: authored.category,
    properties: authored.properties,
    abilities: authored.abilities
  }
}
