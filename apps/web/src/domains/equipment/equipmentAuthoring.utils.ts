import type { ChargeDto } from '@artificer-toolkit/schema/shared'
import type {
  CapacityDto,
  ContainsDto,
  CostDto,
  WeightDto
} from '@artificer-toolkit/schema/subjects/shared'
import type { EquipmentAuthoringInputDto } from '@artificer-toolkit/schema/subjects/equipment'
import { EQUIPMENT_CATEGORY_CODE, MEASUREMENT_UNIT_CODE } from '@artificer-toolkit/shared/core'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type { ModifierGrantDto } from '@artificer-toolkit/schema/grants/modifier'

type BaseEquipmentDto = Exclude<
  EquipmentAuthoringInputDto,
  { category: typeof EQUIPMENT_CATEGORY_CODE.VARIANT }
>
type VariantEquipmentDto = Extract<
  EquipmentAuthoringInputDto,
  { category: typeof EQUIPMENT_CATEGORY_CODE.VARIANT }
>

export type EquipmentFormValues = {
  kind: 'EQUIPMENT'
  id: string
  label: string
  description: string
  status?: EquipmentAuthoredDto['status']
  quote?: string
  rarityId: string
  systemId: string
  category: EquipmentAuthoredDto['category']
  parentEquipmentId?: string
  attributes?: BaseEquipmentDto['attributes']
  properties?: NonNullable<EquipmentAuthoredDto['properties']>
  cost?: CostDto
  weight?: WeightDto
  capacity?: CapacityDto
  maxStack?: number
  armorClass?: number
  contains?: ContainsDto[]
  effects?: EquipmentAuthoredDto['effects']
  charges?: ChargeDto
  modifiers?: ModifierGrantDto[]
  features?: FeatureDto[]
  restrictions?: EquipmentAuthoredDto['restrictions']
  requiresAttunement?: EquipmentAuthoredDto['requiresAttunement']
}

interface CreateEmptyEquipmentInput {
  systemId: string
}

export function createEmptyBaseEquipment({
  systemId
}: CreateEmptyEquipmentInput): EquipmentFormValues {
  return {
    kind: 'EQUIPMENT',
    id: crypto.randomUUID(),
    label: '',
    description: '',
    status: 'DRAFT',
    quote: '',
    rarityId: '',
    systemId,
    category: EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    attributes: [],
    properties: [],
    weight: createEmptyWeight(),
    effects: [],
    modifiers: [],
    features: [],
    contains: [],
    requiresAttunement: false
  }
}

export function createEmptyEquipment(input: CreateEmptyEquipmentInput): EquipmentFormValues {
  return createEmptyBaseEquipment(input)
}

function createEmptyWeight(): WeightDto {
  return {
    amount: 0,
    unit: MEASUREMENT_UNIT_CODE.POUNDS
  }
}

export function toEquipmentFormValues(
  equipment: EquipmentAuthoringInputDto | EquipmentAuthoredDto | EquipmentFormValues
): EquipmentFormValues {
  if (equipment.category === EQUIPMENT_CATEGORY_CODE.VARIANT) {
    return {
      ...equipment,
      description: equipment.description ?? '',
      quote: equipment.quote ?? '',
      properties: equipment.properties ?? [],
      effects: equipment.effects ?? [],
      modifiers: equipment.modifiers ?? [],
      features: equipment.features ?? []
    }
  }

  return {
    ...equipment,
    description: equipment.description ?? '',
    quote: equipment.quote ?? '',
    attributes: equipment.attributes ?? [],
    properties: equipment.properties ?? [],
    effects: equipment.effects ?? [],
    modifiers: equipment.modifiers ?? [],
    features: equipment.features ?? [],
    contains: equipment.contains ?? [],
    weight: equipment.weight ?? createEmptyWeight()
  }
}

export function normalizeEquipmentForSubmit(
  equipment: EquipmentFormValues
): EquipmentAuthoringInputDto {
  const common = {
    kind: 'EQUIPMENT' as const,
    id: equipment.id,
    label: equipment.label.trim(),
    description: equipment.description ?? '',
    status: equipment.status,
    quote: equipment.quote ?? '',
    rarityId: equipment.rarityId,
    systemId: equipment.systemId,
    // Hiding the grip for a non-attack effect clears the form value to undefined; storage is null.
    effects: (equipment.effects ?? []).map((effect) => ({ ...effect, grip: effect.grip ?? null })),
    charges: equipment.charges,
    modifiers: equipment.modifiers ?? [],
    features: equipment.features ?? [],
    restrictions: equipment.restrictions,
    requiresAttunement: equipment.requiresAttunement
  }

  if (equipment.category === EQUIPMENT_CATEGORY_CODE.VARIANT) {
    return {
      ...common,
      category: EQUIPMENT_CATEGORY_CODE.VARIANT,
      parentEquipmentId: equipment.parentEquipmentId ?? '',
      properties: equipment.properties ?? []
    } satisfies VariantEquipmentDto
  }

  return {
    ...common,
    category: equipment.category,
    attributes: equipment.attributes ?? [],
    cost: equipment.cost,
    weight: equipment.weight ?? createEmptyWeight(),
    capacity: equipment.capacity,
    maxStack: equipment.maxStack,
    armorClass: equipment.armorClass,
    contains: equipment.contains ?? [],
    properties: equipment.properties ?? []
  } satisfies BaseEquipmentDto
}
