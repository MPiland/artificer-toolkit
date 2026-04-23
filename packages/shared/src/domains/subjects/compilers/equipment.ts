import type {
  BaseEquipmentAuthored,
  EquipmentAuthored,
  VariantEquipmentAuthored
} from '#authored'
import type {
  EquipmentAttribute,
  EquipmentCategoryCode,
  EquipmentPropertyCode,
  MeasurementUnitCode
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

export interface ResolvedEquipmentVariantInherited {
  category: Exclude<
    EquipmentCategoryCode,
    typeof EQUIPMENT_CATEGORY_CODE.VARIANT
  >
  properties: EquipmentPropertyCode[]
  description: BaseEquipmentAuthored['description']
  quote?: BaseEquipmentAuthored['quote']
  cost?: BaseEquipmentAuthored['cost']
  weight: BaseEquipmentAuthored['weight']
  attributes?: EquipmentAttribute[]
  effects?: BaseEquipmentAuthored['effects']
  charges?: BaseEquipmentAuthored['charges']
  capacity?: BaseEquipmentAuthored['capacity']
  modifiers?: BaseEquipmentAuthored['modifiers']
  maxStack?: BaseEquipmentAuthored['maxStack']
  rarityId: BaseEquipmentAuthored['rarityId']
  maxBonus?: BaseEquipmentAuthored['maxBonus']
  armorClass?: BaseEquipmentAuthored['armorClass']
  contains?: BaseEquipmentAuthored['contains']
  features?: BaseEquipmentAuthored['features']
  restrictions?: BaseEquipmentAuthored['restrictions']
}

export interface ResolvedEquipmentVariantMeta {
  parentEquipmentId: string
  parentLabel: string
  inherited: ResolvedEquipmentVariantInherited
}

export type ResolvedEquipment = Omit<
  BaseEquipmentAuthored,
  'category' | 'properties'
> & {
  category: Exclude<
    EquipmentCategoryCode,
    typeof EQUIPMENT_CATEGORY_CODE.VARIANT
  >
  properties: EquipmentPropertyCode[]
  variant?: ResolvedEquipmentVariantMeta
}

export type CompiledEquipmentBase = {
  id: string
  cost?: CompiledCost
  weight?: CompiledWeight
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
} & CompiledEquipmentBase

export type CompiledEquipmentVariant = {
  category: typeof EQUIPMENT_CATEGORY_CODE.VARIANT
  parentEquipmentId: string
  properties?: EquipmentPropertyCode[]
} & CompiledEquipmentBase

function mergeOrderedValues<T>(
  parent?: readonly T[],
  child?: readonly T[]
): T[] | undefined {
  const merged = [
    ...(parent ?? []),
    ...(child ?? [])
  ]

  return merged.length > 0 ? [...merged] : undefined
}

function mergeUniqueValues<T extends string>(
  parent?: readonly T[],
  child?: readonly T[]
): T[] | undefined {
  const merged = [
    ...(parent ?? []),
    ...(child ?? [])
  ]

  return merged.length > 0 ? [...new Set(merged)] : undefined
}

function compileEquipmentBase(
  authored: EquipmentAuthored | VariantEquipmentAuthored | ResolvedEquipment
): CompiledEquipmentBase {
  const effects
    = authored.effects?.length
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

  return {
    id: authored.id,
    cost: 'cost' in authored ? authored.cost : undefined,
    weight: 'weight' in authored ? authored.weight : undefined,
    attributes: 'attributes' in authored ? authored.attributes : undefined,
    capacity: 'capacity' in authored ? authored.capacity : undefined,
    charges,
    effects,
    features,
    rarityId: authored.rarityId,
    maxBonus: authored.maxBonus,
    maxStack: 'maxStack' in authored ? authored.maxStack : undefined,
    armorClass: 'armorClass' in authored ? authored.armorClass : undefined,
    contains: 'contains' in authored ? authored.contains : undefined,
    modifiers
  }
}

export function resolveEquipmentAuthored(
  authored: EquipmentAuthored | VariantEquipmentAuthored,
  lookupParent: (id: string) => EquipmentAuthored | VariantEquipmentAuthored | null | undefined,
  lineage: string[] = []
): ResolvedEquipment {
  if (authored.category !== EQUIPMENT_CATEGORY_CODE.VARIANT) {
    return {
      ...authored,
      category: authored.category,
      properties: [...authored.properties]
    }
  }

  if (lineage.includes(authored.id)) {
    throw new Error(`Equipment variant cycle detected for "${authored.id}".`)
  }

  const parent = lookupParent(authored.parentEquipmentId)

  if (!parent) {
    throw new Error(
      `Equipment variant "${authored.id}" is missing parent equipment "${authored.parentEquipmentId}".`
    )
  }

  const resolvedParent = resolveEquipmentAuthored(parent, lookupParent, [
    ...lineage,
    authored.id
  ])
  const properties = mergeUniqueValues(
    resolvedParent.properties,
    authored.properties
  ) ?? []

  return {
    kind: authored.kind,
    id: authored.id,
    label: authored.label,
    description: authored.description ?? resolvedParent.description,
    attributes: resolvedParent.attributes,
    quote: authored.quote ?? resolvedParent.quote,
    cost: resolvedParent.cost,
    weight: resolvedParent.weight,
    effects: mergeOrderedValues(
      resolvedParent.effects,
      authored.effects
    ),
    charges: authored.charges ?? resolvedParent.charges,
    capacity: resolvedParent.capacity,
    modifiers: mergeOrderedValues(
      resolvedParent.modifiers,
      authored.modifiers
    ),
    maxStack: resolvedParent.maxStack,
    rarityId: authored.rarityId,
    maxBonus: authored.maxBonus ?? resolvedParent.maxBonus,
    armorClass: resolvedParent.armorClass,
    contains: resolvedParent.contains,
    features: mergeOrderedValues(
      resolvedParent.features,
      authored.features
    ),
    restrictions: authored.restrictions ?? resolvedParent.restrictions,
    userId: authored.userId,
    systemId: authored.systemId,
    category: resolvedParent.category,
    properties,
    variant: {
      parentEquipmentId: authored.parentEquipmentId,
      parentLabel: parent.label,
      inherited: {
        category: resolvedParent.category,
        properties: [...resolvedParent.properties],
        description: resolvedParent.description,
        quote: resolvedParent.quote,
        cost: resolvedParent.cost,
        weight: resolvedParent.weight,
        attributes: resolvedParent.attributes,
        effects: resolvedParent.effects,
        charges: resolvedParent.charges,
        capacity: resolvedParent.capacity,
        modifiers: resolvedParent.modifiers,
        maxStack: resolvedParent.maxStack,
        rarityId: resolvedParent.rarityId,
        maxBonus: resolvedParent.maxBonus,
        armorClass: resolvedParent.armorClass,
        contains: resolvedParent.contains,
        features: resolvedParent.features,
        restrictions: resolvedParent.restrictions
      }
    }
  }
}

export function compileEquipment(
  authored: EquipmentAuthored | VariantEquipmentAuthored
): CompiledEquipment | CompiledEquipmentVariant {
  const base = compileEquipmentBase(authored)

  if (authored.category === EQUIPMENT_CATEGORY_CODE.VARIANT) {
    return {
      ...base,
      category: EQUIPMENT_CATEGORY_CODE.VARIANT,
      parentEquipmentId: authored.parentEquipmentId,
      properties: authored.properties
    }
  }

  // Otherwise, it's non-variant equipment
  return {
    ...base,
    category: authored.category,
    properties: authored.properties
  }
}

export function compileResolvedEquipment(
  authored: ResolvedEquipment
): CompiledEquipment {
  return {
    ...compileEquipmentBase(authored),
    category: authored.category,
    properties: authored.properties
  }
}

