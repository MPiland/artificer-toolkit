import {
  type SUBJECT,
  type EQUIPMENT_CATEGORY_CODE,
  type MeasurementUnitCode,
  type OperationCode,
  type AbilityCode,
  type EquipmentPropertyCode,
  type EquipmentCategoryCode,
  type EquipmentAttribute,
  type NodeSubjectCode
} from '#core'
import {
  type CapabilityAuthored,
  type EffectAuthored,
  type ModifierGrantAuthored,
  type ChargeAuthored,
  type FeatureAuthored,
  type FacetAuthored
} from '#authored'

/** Item weight for encumbrance or transport calculations */
export interface WeightAuthored {
  amount: number
  unit: MeasurementUnitCode
}

/** Capacity limit (used for containers, vehicles, etc.) */
export interface CapacityAuthored {
  amount: number
  unit: MeasurementUnitCode
}

/** Item cost in the system’s currency registry */
export interface CostAuthored {
  amount: number
  currencyId: string
}

/** Nested item container or bundle definition */
export interface ContainsAuthored {
  equipmentId: string
  quantity: number
}

export type EquipmentAbilitiesAuthored = {
  op: OperationCode
  abilities: { ability: AbilityCode }[]
}

export type EquipmentBaseAuthored = {
  kind: typeof SUBJECT.EQUIPMENT
  id: string
  label: string
  description: string | null
  attributes?: EquipmentAttribute[]
  quote?: string
  cost?: CostAuthored
  weight: WeightAuthored
  capabilities?: CapabilityAuthored[]
  /** @deprecated Use capabilities. */
  effects?: EffectAuthored[]
  charges?: ChargeAuthored
  capacity?: CapacityAuthored
  modifiers?: ModifierGrantAuthored[]
  maxStack?: number
  rarityId: string
  maxBonus?: number
  armorClass?: number
  contains?: ContainsAuthored[]
  features?: FeatureAuthored<Extract<NodeSubjectCode, 'EQUIPMENT'>>[]
  restrictions?: FacetAuthored<Extract<NodeSubjectCode, 'EQUIPMENT'>>
  userId: string
  systemId: string
}

export type EquipmentAuthored = {
  kind: typeof SUBJECT.EQUIPMENT
  properties: EquipmentPropertyCode[]
  category: Exclude<EquipmentCategoryCode, typeof EQUIPMENT_CATEGORY_CODE.VARIANT>
  abilities: EquipmentAbilitiesAuthored[]
} & EquipmentBaseAuthored

export type EquipmentVariantAuthored = {
  category: typeof EQUIPMENT_CATEGORY_CODE.VARIANT
  parentEquipmentId: string
  properties?: EquipmentPropertyCode[]
} & EquipmentBaseAuthored
