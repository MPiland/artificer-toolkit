import { PREPARE_LIMIT_METHOD_KIND } from '@artificer-toolkit/shared/subjects/core'
import { z } from '../zod.js'
import { chargeDtoSchema } from '../shared/charge.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
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
  spellLevel: z.number().check(z.int()),
  slotCount: z.number().check(z.int())
})
export type ClassSpellSlotDto = z.infer<typeof classSpellSlotDtoSchema>

export const classSpellLimitDtoSchema = z.object({
  classLevel: z.number().check(z.int()),
  slots: authoredNestedCollectionSchema(classSpellSlotDtoSchema),
  learnedSpellsLimit: z.optional(z.number().check(z.int())),
  preparedSpellsLimit: z.optional(z.number().check(z.int())),
  cantripsLimit: z.optional(z.number().check(z.int()))
})
export type ClassSpellLimitDto = z.infer<typeof classSpellLimitDtoSchema>

export const classPrepareLimitPerLevelDtoSchema = z.object({
  classLevel: z.number().check(z.int()),
  amount: z.number().check(z.int())
})

export const classPrepareLimitDtoSchema = z.object({
  methodKinds: authoredReferenceCollectionSchema(z.enum(PREPARE_LIMIT_METHOD_KIND)),
  scaling: z.optional(scalingAmountKindSchema),
  rounding: z.optional(roundingCodeSchema),
  perLevel: z.optional(authoredNestedCollectionSchema(classPrepareLimitPerLevelDtoSchema))
})
export type ClassPrepareLimitDto = z.infer<typeof classPrepareLimitDtoSchema>

export const classResourceDtoSchema = z.object({
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  description: z.optional(authoredRichTextSchema),
  availableAtLevel: z.number().check(z.int()),
  order: z.optional(z.number().check(z.int())),
  charges: chargeDtoSchema
})
export type ClassResourceDto = z.infer<typeof classResourceDtoSchema>

export const classHitpointDtoSchema = z.object({
  ability: abilityCodeSchema,
  dieConfig: authoredIdentifierSchema
})
export type ClassHitpointDto = z.infer<typeof classHitpointDtoSchema>

export const classStartingGoldDtoSchema = z.object({
  multiplier: z.number().check(z.int()),
  currencyId: authoredIdentifierSchema,
  dieConfig: authoredIdentifierSchema
})
export type ClassStartingGoldDto = z.infer<typeof classStartingGoldDtoSchema>

export const classMulticlassRequirementDtoSchema = z.object({
  id: authoredIdentifierSchema,
  ability: abilityCodeSchema,
  min: z.number().check(z.int())
})

export const classMulticlassRequirementGroupDtoSchema = z.object({
  id: authoredIdentifierSchema,
  requirements: authoredNestedCollectionSchema(classMulticlassRequirementDtoSchema)
})

export const classMulticlassRequirementGroupsDtoSchema = z.object({
  groups: authoredNestedCollectionSchema(classMulticlassRequirementGroupDtoSchema)
})

export const classMulticlassDtoSchema = z.object({
  id: authoredIdentifierSchema,
  requirementGroups: classMulticlassRequirementGroupsDtoSchema,
  proficiencies: z.optional(authoredNestedCollectionSchema(proficiencyGrantDtoSchema))
})
export type ClassMulticlassDto = z.infer<typeof classMulticlassDtoSchema>

export const classSpecializationDtoSchema = z.object({
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  order: z.number().check(z.int())
})
export type ClassSpecializationDto = z.infer<typeof classSpecializationDtoSchema>

export const raceAncestryOptionDtoSchema = z.object({
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  description: authoredRichTextSchema,
  order: z.number().check(z.int()),
  features: z.optional(authoredNestedCollectionSchema(featureDtoSchema))
})

export const raceAncestryDtoSchema = z.object({
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  description: z.optional(z.nullable(authoredRichTextSchema)),
  options: authoredNestedCollectionSchema(raceAncestryOptionDtoSchema)
})

export const costDtoSchema = z.object({
  amount: z.number(),
  currencyId: authoredIdentifierSchema
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
  equipmentId: authoredIdentifierSchema,
  quantity: z.number()
})
export type ContainsDto = z.infer<typeof containsDtoSchema>

export const equipmentAbilityDtoSchema = z.object({
  op: operationCodeSchema,
  abilities: authoredNestedCollectionSchema(
    z.object({
      ability: abilityCodeSchema
    })
  )
})

export { castingTimeDtoSchema } from './castingTime.js'
