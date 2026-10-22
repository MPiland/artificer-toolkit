import type {
  VehicleAuthoringInputDto,
  VehicleAuthoredDto
} from '@artificer-toolkit/schema/subjects/vehicle'
import { VEHICLE_CATEGORY_CODE } from '@artificer-toolkit/shared/core'

type VehiclePropertyFormValue = {
  value: string
}

export type VehicleFormValues = Omit<VehicleAuthoringInputDto, 'properties' | 'userId'> & {
  properties?: VehiclePropertyFormValue[]
}

interface CreateEmptyVehicleInput {
  systemId: string
}

export function createEmptyVehicle({ systemId }: CreateEmptyVehicleInput): VehicleFormValues {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    status: 'DRAFT',
    details: [],
    systemId,
    category: VEHICLE_CATEGORY_CODE.LAND,
    properties: [],
    features: []
  }
}

export function toVehicleFormValues(
  vehicle: VehicleAuthoringInputDto | VehicleAuthoredDto | VehicleFormValues
): VehicleFormValues {
  return {
    ...vehicle,
    description: vehicle.description ?? '',
    details: vehicle.details ?? [],
    properties: toPropertyFormValues(vehicle.properties),
    features: vehicle.features ?? []
  }
}

export function normalizeVehicleForSubmit(vehicle: VehicleFormValues): VehicleAuthoringInputDto {
  return {
    id: vehicle.id,
    label: vehicle.label.trim() || 'Untitled Vehicle',
    description: vehicle.description ?? '',
    status: vehicle.status ?? 'DRAFT',
    details: vehicle.details ?? [],
    systemId: vehicle.systemId,
    category: vehicle.category,
    size: vehicle.size,
    armorClass: vehicle.armorClass,
    hitPoints: vehicle.hitPoints,
    speed: vehicle.speed,
    speedNote: vehicle.speedNote,
    crewMin: vehicle.crewMin,
    crewMax: vehicle.crewMax,
    passengerCapacity: vehicle.passengerCapacity,
    cargoCapacity: vehicle.cargoCapacity,
    cost: vehicle.cost,
    properties: (vehicle.properties ?? [])
      .map((property) => property.value.trim())
      .filter((property) => property.length > 0),
    features: vehicle.features ?? []
  }
}

export function resolveCreateVehicleSystemId(systems: readonly { id: string }[]): string | null {
  return systems[0]?.id ?? null
}

function toPropertyFormValues(
  properties: VehicleAuthoringInputDto['properties'] | VehiclePropertyFormValue[] | undefined
): VehiclePropertyFormValue[] {
  if (!properties) return []

  return properties.map((property) => {
    if (typeof property === 'string') return { value: property }
    return property
  })
}
