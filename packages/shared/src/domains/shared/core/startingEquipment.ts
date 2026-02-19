import type { CoreMeta } from '#core'

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
    tooltip: 'Equipment item.',
    description: 'Grants equipment items directly such as Longsword or Sabres.'
  },

  [STARTING_EQUIPMENT_KIND.CURRENCY]: {
    code: STARTING_EQUIPMENT_KIND.CURRENCY,
    label: 'Currency',
    tooltip: 'Currency such as gold.',
    description: 'Gives the character currency to use during campaigns.'
  }
} as const

export const STARTING_EQUIPMENT_KIND_OPTIONS = Object.values(
  STARTING_EQUIPMENT_KIND_REGISTRY
) as StartingEquipmentKindOption[]
