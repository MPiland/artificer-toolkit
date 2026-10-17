import type {
  BaseEquipmentAuthored,
  EquipmentAuthored,
  EquipmentEffectAuthored,
  VariantEquipmentAuthored
} from '#authored'
import type {
  EquipmentAttribute,
  EquipmentCategoryCode,
  EquipmentGrip,
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
  category: Exclude<EquipmentCategoryCode, typeof EQUIPMENT_CATEGORY_CODE.VARIANT>
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
  armorClass?: BaseEquipmentAuthored['armorClass']
  contains?: BaseEquipmentAuthored['contains']
  features?: BaseEquipmentAuthored['features']
  restrictions?: BaseEquipmentAuthored['restrictions']
  requiresAttunement?: BaseEquipmentAuthored['requiresAttunement']
}

export interface ResolvedEquipmentVariantMeta {
  parentEquipmentId: string
  /** The full variant ancestry, nearest parent first. */
  ancestorEquipmentIds: string[]
  parentLabel: string
  inherited: ResolvedEquipmentVariantInherited
}

export type ResolvedEquipment = BaseEquipmentAuthored & { variant?: ResolvedEquipmentVariantMeta }

export type CompiledEquipmentEffectGroup = CompiledEffectGroup & {
  grip: EquipmentGrip | null
  requirements?: EquipmentEffectAuthored['requirements']
}

export type CompiledEquipmentBase = {
  id: string
  /** Retained for bounded play-surface projections; historical snapshots may omit it. */
  label?: string
  restrictions?: BaseEquipmentAuthored['restrictions']
  requiresAttunement?: BaseEquipmentAuthored['requiresAttunement']
  cost?: CompiledCost
  weight?: CompiledWeight
  attributes?: EquipmentAttribute[]
  effects?: CompiledEquipmentEffectGroup[]
  charges?: CompiledCharge
  capacity?: CompiledCapacity
  modifiers?: CompiledModifierGrant[]
  maxStack?: number
  rarityId: string
  armorClass?: number
  contains?: CompiledContainsAuthored[]
  features?: CompiledFeature[]
}

export type CompiledEquipment = {
  properties: EquipmentPropertyCode[]
  category: Exclude<EquipmentCategoryCode, typeof EQUIPMENT_CATEGORY_CODE.VARIANT>
  /** Variant ancestry of a resolved item, nearest parent first; empty for base equipment. */
  parentEquipmentIds: string[]
} & CompiledEquipmentBase

export type CompiledEquipmentVariant = {
  category: typeof EQUIPMENT_CATEGORY_CODE.VARIANT
  parentEquipmentId: string
  properties?: EquipmentPropertyCode[]
} & CompiledEquipmentBase

function mergeOrderedValues<T>(parent?: readonly T[], child?: readonly T[]): T[] | undefined {
  const merged = [...(parent ?? []), ...(child ?? [])]

  return merged.length > 0 ? [...merged] : undefined
}

function mergeUniqueValues<T extends string>(
  parent?: readonly T[],
  child?: readonly T[]
): T[] | undefined {
  const merged = [...(parent ?? []), ...(child ?? [])]

  return merged.length > 0 ? [...new Set(merged)] : undefined
}

function compileEquipmentBase(
  authored: EquipmentAuthored | VariantEquipmentAuthored | ResolvedEquipment
): CompiledEquipmentBase {
  const effects = authored.effects?.length
    ? authored.effects.map((effect: EquipmentEffectAuthored): CompiledEquipmentEffectGroup => ({
        ...compileEffect(effect),
        grip: effect.grip,
        ...(effect.requirements ? { requirements: effect.requirements } : {})
      }))
    : undefined

  const features =
    authored.features && authored.features.length
      ? authored.features.map((feature) =>
          compileFeature(feature as Parameters<typeof compileFeature>[0])
        )
      : undefined

  const charges = authored.charges ? compileCharge(authored.charges) : undefined

  const modifiers =
    authored.modifiers && authored.modifiers.length
      ? authored.modifiers.map(compileModifierGrant)
      : undefined

  return {
    id: authored.id,
    label: authored.label,
    restrictions: authored.restrictions,
    requiresAttunement: authored.requiresAttunement,
    cost: 'cost' in authored ? authored.cost : undefined,
    weight: 'weight' in authored ? authored.weight : undefined,
    attributes: 'attributes' in authored ? authored.attributes : undefined,
    capacity: 'capacity' in authored ? authored.capacity : undefined,
    charges,
    effects,
    features,
    rarityId: authored.rarityId,
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
    return { ...authored, properties: [...authored.properties] }
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

  const resolvedParent = resolveEquipmentAuthored(parent, lookupParent, [...lineage, authored.id])
  const properties = mergeUniqueValues(resolvedParent.properties, authored.properties) ?? []

  return {
    // The parent's category and its Armor Class stay paired (D143); every other field is set below.
    ...resolvedParent,
    kind: authored.kind,
    id: authored.id,
    label: authored.label,
    description: authored.description ?? resolvedParent.description,
    status: authored.status,
    attributes: resolvedParent.attributes,
    quote: authored.quote ?? resolvedParent.quote,
    cost: resolvedParent.cost,
    weight: resolvedParent.weight,
    effects: mergeOrderedValues(resolvedParent.effects, authored.effects),
    charges: authored.charges ?? resolvedParent.charges,
    capacity: resolvedParent.capacity,
    modifiers: mergeOrderedValues(resolvedParent.modifiers, authored.modifiers),
    maxStack: resolvedParent.maxStack,
    rarityId: authored.rarityId,
    contains: resolvedParent.contains,
    features: mergeOrderedValues(resolvedParent.features, authored.features),
    restrictions: authored.restrictions ?? resolvedParent.restrictions,
    requiresAttunement: authored.requiresAttunement ?? resolvedParent.requiresAttunement,
    userId: authored.userId,
    systemId: authored.systemId,
    properties,
    variant: {
      parentEquipmentId: authored.parentEquipmentId,
      ancestorEquipmentIds: [
        authored.parentEquipmentId,
        ...(resolvedParent.variant?.ancestorEquipmentIds ?? [])
      ],
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
        armorClass: resolvedParent.armorClass,
        contains: resolvedParent.contains,
        features: resolvedParent.features,
        restrictions: resolvedParent.restrictions,
        requiresAttunement: resolvedParent.requiresAttunement
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
    properties: authored.properties,
    parentEquipmentIds: []
  }
}

export function compileResolvedEquipment(authored: ResolvedEquipment): CompiledEquipment {
  return {
    ...compileEquipmentBase(authored),
    category: authored.category,
    properties: authored.properties,
    parentEquipmentIds: authored.variant?.ancestorEquipmentIds ?? []
  }
}
