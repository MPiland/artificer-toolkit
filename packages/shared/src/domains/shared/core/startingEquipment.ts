import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const STARTING_EQUIPMENT_KIND = {
  EQUIPMENT: 'EQUIPMENT',
  CURRENCY: 'CURRENCY'
} as const

export type StartingEquipmentKind = keyof typeof STARTING_EQUIPMENT_KIND

export type StartingEquipmentKindOption = CoreMeta<StartingEquipmentKind>

export const STARTING_EQUIPMENT_KIND_REGISTRY: Record<
  StartingEquipmentKind,
  StartingEquipmentKindOption
> = {
  [STARTING_EQUIPMENT_KIND.EQUIPMENT]: {
    code: STARTING_EQUIPMENT_KIND.EQUIPMENT,
    label: 'Equipment Item',
    description: 'Equipment item.'
  },

  [STARTING_EQUIPMENT_KIND.CURRENCY]: {
    code: STARTING_EQUIPMENT_KIND.CURRENCY,
    label: 'Currency',
    description: 'Currency such as gold.'
  }
} as const

export const STARTING_EQUIPMENT_KIND_OPTIONS = valuesOf(
  STARTING_EQUIPMENT_KIND_REGISTRY
) as StartingEquipmentKindOption[]
