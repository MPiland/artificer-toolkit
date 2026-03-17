import { type CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const VEHICLE_CATEGORY_CODE = {
  LAND: 'LAND',
  WATER: 'WATER',
  AIR: 'AIR',
  SPELLJAMMER: 'SPELLJAMMER',
} as const

export type VehicleCategoryCode = keyof typeof VEHICLE_CATEGORY_CODE

export type VehicleCategoryOption = CoreMeta<VehicleCategoryCode>

export const VEHICLE_CATEGORY_REGISTRY: Record<
  VehicleCategoryCode,
  VehicleCategoryOption
> = {
  [VEHICLE_CATEGORY_CODE.LAND]: {
    code: VEHICLE_CATEGORY_CODE.LAND,
    label: 'Land',
    description: 'Ground vehicles such as carts, wagons, and siege engines.',
  },
  [VEHICLE_CATEGORY_CODE.WATER]: {
    code: VEHICLE_CATEGORY_CODE.WATER,
    label: 'Water',
    description: 'Boats, ships, and other watercraft.',
  },
  [VEHICLE_CATEGORY_CODE.AIR]: {
    code: VEHICLE_CATEGORY_CODE.AIR,
    label: 'Air',
    description: 'Flying vehicles such as airships or magical skiffs.',
  },
  [VEHICLE_CATEGORY_CODE.SPELLJAMMER]: {
    code: VEHICLE_CATEGORY_CODE.SPELLJAMMER,
    label: 'Spelljammer',
    description: 'Spacefaring magical vessels using spelljamming rules.',
  },
} as const

export const VEHICLE_CATEGORY_OPTIONS = valuesOf(
  VEHICLE_CATEGORY_REGISTRY
) as readonly VehicleCategoryOption[]
