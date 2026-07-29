export * from '../shared/index.js'
export * from '../effects/index.js'
export * from '../grants/index.js'
export * from '../features/index.js'

import { PREPARE_LIMIT_METHOD_KIND } from '@artificer-toolkit/shared/subjects/core'
import { z } from 'zod'
import { chargeDtoSchema } from '../shared/charge.js'
import { featureDtoSchema } from '../features/feature.js'
import { proficiencyGrantDtoSchema } from '../grants/proficiency.js'
import {
  abilityCodeSchema,
  measurementUnitCodeSchema,
  operationCodeSchema,
  roundingCodeSchema,
  scalingAmountKindSchema
} from '../shared/enums.js'

export const classSpellSlotDtoSchema = z.object({
  spellLevel: z.number().int(),
  slotCount: z.number().int()
})
export type ClassSpellSlotDto = z.infer<typeof classSpellSlotDtoSchema>

export const classSpellLimitDtoSchema = z.object({
  classLevel: z.number().int(),
  slots: z.array(classSpellSlotDtoSchema),
  learnedSpellsLimit: z.number().int().optional(),
  preparedSpellsLimit: z.number().int().optional(),
  cantripsLimit: z.number().int().optional()
})
export type ClassSpellLimitDto = z.infer<typeof classSpellLimitDtoSchema>

export const classPrepareLimitPerLevelDtoSchema = z.object({
  classLevel: z.number().int(),
  amount: z.number().int()
})

export const classPrepareLimitDtoSchema = z.object({
  methodKinds: z.array(z.enum(PREPARE_LIMIT_METHOD_KIND)),
  scaling: scalingAmountKindSchema.optional(),
  rounding: roundingCodeSchema.optional(),
  perLevel: z.array(classPrepareLimitPerLevelDtoSchema).optional()
})
export type ClassPrepareLimitDto = z.infer<typeof classPrepareLimitDtoSchema>

export const classResourceDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  availableAtLevel: z.number().int(),
  order: z.number().int().optional(),
  charges: chargeDtoSchema
})
export type ClassResourceDto = z.infer<typeof classResourceDtoSchema>

export const classHitpointDtoSchema = z.object({
  ability: abilityCodeSchema,
  dieConfig: z.string()
})
export type ClassHitpointDto = z.infer<typeof classHitpointDtoSchema>

export const classStartingGoldDtoSchema = z.object({
  multiplier: z.number().int(),
  currencyId: z.string(),
  dieConfig: z.string()
})
export type ClassStartingGoldDto = z.infer<typeof classStartingGoldDtoSchema>

export const classMulticlassRequirementDtoSchema = z.object({
  id: z.string(),
  ability: abilityCodeSchema,
  min: z.number().int()
})

export const classMulticlassRequirementGroupDtoSchema = z.object({
  id: z.string(),
  requirements: z.array(classMulticlassRequirementDtoSchema)
})

export const classMulticlassRequirementGroupsDtoSchema = z.object({
  groups: z.array(classMulticlassRequirementGroupDtoSchema)
})

export const classMulticlassDtoSchema = z.object({
  id: z.string(),
  requirementGroups: classMulticlassRequirementGroupsDtoSchema,
  proficiencies: z.array(proficiencyGrantDtoSchema).optional()
})
export type ClassMulticlassDto = z.infer<typeof classMulticlassDtoSchema>

export const classSpecializationDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  order: z.number().int()
})
export type ClassSpecializationDto = z.infer<typeof classSpecializationDtoSchema>

export const raceAncestryOptionDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  order: z.number().int(),
  features: z.array(featureDtoSchema).optional()
})

export const raceAncestryDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
  options: z.array(raceAncestryOptionDtoSchema)
})

export const costDtoSchema = z.object({
  amount: z.number(),
  currencyId: z.string()
})
export type CostDto = z.infer<typeof costDtoSchema>

export const weightDtoSchema = z.object({
  amount: z.number(),
  unit: measurementUnitCodeSchema
})
export type WeightDto = z.infer<typeof weightDtoSchema>

export const capacityDtoSchema = z.object({
  amount: z.number(),
  unit: measurementUnitCodeSchema
})
export type CapacityDto = z.infer<typeof capacityDtoSchema>

export const containsDtoSchema = z.object({
  equipmentId: z.string(),
  quantity: z.number()
})
export type ContainsDto = z.infer<typeof containsDtoSchema>

export const equipmentAbilityDtoSchema = z.object({
  op: operationCodeSchema,
  abilities: z.array(
    z.object({
      ability: abilityCodeSchema
    })
  )
})

export const castingTimeDtoSchema = z.object({
  unit: z.enum(['ROUND', 'MINUTE', 'HOUR']),
  amount: z.number()
})
