import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  DAMAGE_VALUE_KIND,
  EQUIPMENT_ATTRIBUTE,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  TARGET_SELECTION_KIND,
  SUBJECT,
  TRIGGER
} from '@artificer-toolkit/shared'
import {
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'

export {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  DAMAGE_VALUE_KIND,
  EQUIPMENT_ATTRIBUTE,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  TARGET_SELECTION_KIND,
  SUBJECT,
  TRIGGER,
  SRD_SYSTEM_ID,
  SRD_USER_ID
}

export function equipId(index: number): string {
  const hex = index.toString(16).padStart(4, '0')
  return `00000000-0000-0000-0060-${hex}00000000`
}

export const RARITY_COMMON = '00000000-0000-0000-0008-000100000000'
export const RARITY_UNCOMMON = '00000000-0000-0000-0008-000200000000'
export const RARITY_RARE = '00000000-0000-0000-0008-000300000000'
export const RARITY_VERY_RARE = '00000000-0000-0000-0008-000400000000'
export const RARITY_LEGENDARY = '00000000-0000-0000-0008-000500000000'
const CURRENCY_GP = '00000000-0000-0000-0003-000400000000'
const CURRENCY_SP = '00000000-0000-0000-0003-000300000000'
const CURRENCY_CP = '00000000-0000-0000-0003-000200000000'

export function gp(amount: number) {
  return { amount, currencyId: CURRENCY_GP }
}

export function sp(amount: number) {
  return { amount, currencyId: CURRENCY_SP }
}

export function cp(amount: number) {
  return { amount, currencyId: CURRENCY_CP }
}

export function lbs(amount: number) {
  return { amount, unit: MEASUREMENT_UNIT_CODE.POUNDS }
}

export function conditionTypeId(code: string): string {
  const entry = SRD_CONDITION_TYPES.find((conditionType) => conditionType.code === code)
  if (!entry) {
    throw new Error(`SRD condition type vocabulary entry for ${code} required for equipment source data.`)
  }

  return entry.id
}

export function damageTypeId(code: string): string {
  const entry = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === code)
  if (!entry) {
    throw new Error(`SRD damage type vocabulary entry for ${code} required for equipment source data.`)
  }

  return entry.id
}

export function equipmentChildId(equipmentId: string, bucket: number, index: number): string {
  const [, , , , equipmentSuffix] = equipmentId.split('-')
  const bucketHex = bucket.toString(16).padStart(4, '0')
  const indexHex = index.toString(16).padStart(12, '0')

  return `00000000-0000-${bucketHex}-${equipmentSuffix.slice(0, 4)}-${indexHex}`
}
