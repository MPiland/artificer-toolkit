import {
  type SUBJECT,
  type EQUIPMENT_CATEGORY_CODE,
  type MeasurementUnitCode,
  type EquipmentPropertyCode,
  type EquipmentCategoryCode,
  type EquipmentAttribute,
  type EquipmentGrip,
  type NodeSubjectCode,
  type AuthoredRecordStatus
} from '#core'
import {
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

/**
 * An item effect; weapon attack effects name the grip they are made with. `requirements` gate when
 * the action is offered, decided from the actor's state this turn (the other-weapon Attack action
 * of an off-hand attack).
 */
export type EquipmentEffectAuthored = EffectAuthored & {
  grip: EquipmentGrip | null
  requirements?: FacetAuthored<Extract<NodeSubjectCode, 'CHARACTER'>>
}

/** Nested item container or bundle definition */
export interface ContainsAuthored {
  equipmentId: string
  quantity: number
}

export type BaseEquipmentAuthored = {
  kind: typeof SUBJECT.EQUIPMENT
  id: string
  label: string
  description: string | null
  status?: AuthoredRecordStatus
  attributes?: EquipmentAttribute[]
  quote?: string
  cost?: CostAuthored
  weight?: WeightAuthored
  effects?: EquipmentEffectAuthored[]
  charges?: ChargeAuthored
  capacity?: CapacityAuthored
  modifiers?: ModifierGrantAuthored[]
  maxStack?: number
  rarityId: string
  armorClass?: number
  contains?: ContainsAuthored[]
  features?: FeatureAuthored<Extract<NodeSubjectCode, 'EQUIPMENT'>>[]
  restrictions?: FacetAuthored<Extract<NodeSubjectCode, 'CHARACTER'>>
  requiresAttunement?: boolean
  userId: string
  systemId: string
  properties: EquipmentPropertyCode[]
  category: Exclude<EquipmentCategoryCode, typeof EQUIPMENT_CATEGORY_CODE.VARIANT>
}

export type VariantEquipmentAuthored = {
  kind: typeof SUBJECT.EQUIPMENT
  id: string
  label: string
  description: string | null
  status?: AuthoredRecordStatus
  quote?: string
  effects?: EquipmentEffectAuthored[]
  charges?: ChargeAuthored
  modifiers?: ModifierGrantAuthored[]
  rarityId: string
  features?: FeatureAuthored<Extract<NodeSubjectCode, 'EQUIPMENT'>>[]
  restrictions?: FacetAuthored<Extract<NodeSubjectCode, 'CHARACTER'>>
  requiresAttunement?: boolean
  userId: string
  systemId: string
  category: typeof EQUIPMENT_CATEGORY_CODE.VARIANT
  parentEquipmentId: string
  properties?: EquipmentPropertyCode[]
}

export type EquipmentAuthored = BaseEquipmentAuthored | VariantEquipmentAuthored
export type EquipmentVariantAuthored = VariantEquipmentAuthored
