import { PREPARE_LIMIT_METHOD_KIND } from '@artificer-toolkit/shared/subjects/core'
import { z, lazySchema } from '../zod.js'
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
  measurementUnitCodeSchema,
  operationCodeSchema,
  roundingCodeSchema,
  scalingAmountKindSchema
} from '../shared/enums.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

export const classSpellSlotDtoSchema = lazySchema(() =>
  z.object({
    spellLevel: z.number().check(z.int()),
    slotCount: z.number().check(z.int())
  })
)
export type ClassSpellSlotDto = z.infer<typeof classSpellSlotDtoSchema>

export const classSpellLimitDtoSchema = lazySchema(() =>
  z.object({
    classLevel: z.number().check(z.int()),
    slots: authoredNestedCollectionSchema(classSpellSlotDtoSchema),
    learnedSpellsLimit: z.optional(z.number().check(z.int())),
    preparedSpellsLimit: z.optional(z.number().check(z.int())),
    cantripsLimit: z.optional(z.number().check(z.int()))
  })
)
export type ClassSpellLimitDto = z.infer<typeof classSpellLimitDtoSchema>

export const classPrepareLimitPerLevelDtoSchema = lazySchema(() =>
  z.object({
    classLevel: z.number().check(z.int()),
    amount: z.number().check(z.int())
  })
)

export const classPrepareLimitDtoSchema = lazySchema(() =>
  z.object({
    methodKinds: authoredReferenceCollectionSchema(z.enum(PREPARE_LIMIT_METHOD_KIND)),
    scaling: z.optional(scalingAmountKindSchema),
    rounding: z.optional(roundingCodeSchema),
    perLevel: z.optional(authoredNestedCollectionSchema(classPrepareLimitPerLevelDtoSchema))
  })
)
export type ClassPrepareLimitDto = z.infer<typeof classPrepareLimitDtoSchema>

export const classResourceDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    label: authoredShortTextSchema,
    description: z.optional(authoredRichTextSchema),
    availableAtLevel: z.number().check(z.int()),
    order: z.optional(z.number().check(z.int())),
    charges: chargeDtoSchema
  })
)
export type ClassResourceDto = z.infer<typeof classResourceDtoSchema>

export const classHitpointDtoSchema = lazySchema(() =>
  z.object({
    dieConfig: authoredIdentifierSchema
  })
)
export type ClassHitpointDto = z.infer<typeof classHitpointDtoSchema>

export const classStartingGoldDtoSchema = lazySchema(() =>
  z.object({
    multiplier: z.number().check(z.int()),
    currencyId: authoredIdentifierSchema,
    dieConfig: authoredIdentifierSchema
  })
)
export type ClassStartingGoldDto = z.infer<typeof classStartingGoldDtoSchema>

export const classMulticlassRequirementDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    ability: systemCoreCodeSchema,
    min: z.number().check(z.int())
  })
)

export const classMulticlassRequirementGroupDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    requirements: authoredNestedCollectionSchema(classMulticlassRequirementDtoSchema)
  })
)

export const classMulticlassRequirementGroupsDtoSchema = lazySchema(() =>
  z.object({
    groups: authoredNestedCollectionSchema(classMulticlassRequirementGroupDtoSchema)
  })
)

export const classMulticlassDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    requirementGroups: classMulticlassRequirementGroupsDtoSchema,
    proficiencies: z.optional(authoredNestedCollectionSchema(proficiencyGrantDtoSchema))
  })
)
export type ClassMulticlassDto = z.infer<typeof classMulticlassDtoSchema>

export const classSpecializationDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    label: authoredShortTextSchema,
    order: z.number().check(z.int())
  })
)
export type ClassSpecializationDto = z.infer<typeof classSpecializationDtoSchema>

export const raceAncestryOptionDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    label: authoredShortTextSchema,
    description: authoredRichTextSchema,
    order: z.number().check(z.int()),
    features: z.optional(authoredNestedCollectionSchema(featureDtoSchema))
  })
)

export const raceAncestryDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    label: authoredShortTextSchema,
    description: z.optional(z.nullable(authoredRichTextSchema)),
    options: authoredNestedCollectionSchema(raceAncestryOptionDtoSchema)
  })
)

export const costDtoSchema = lazySchema(() =>
  z.object({
    amount: z.number(),
    currencyId: authoredIdentifierSchema
  })
)
export type CostDto = z.infer<typeof costDtoSchema>

export const weightDtoSchema = lazySchema(() =>
  z.object({
    amount: z.number(),
    unit: measurementUnitCodeSchema
  })
)
export type WeightDto = z.infer<typeof weightDtoSchema>

export const capacityDtoSchema = lazySchema(() =>
  z.object({
    amount: z.number(),
    unit: measurementUnitCodeSchema
  })
)
export type CapacityDto = z.infer<typeof capacityDtoSchema>

export const containsDtoSchema = lazySchema(() =>
  z.object({
    equipmentId: authoredIdentifierSchema,
    quantity: z.number()
  })
)
export type ContainsDto = z.infer<typeof containsDtoSchema>

export const equipmentAbilityDtoSchema = lazySchema(() =>
  z.object({
    op: operationCodeSchema,
    abilities: authoredNestedCollectionSchema(
      z.object({
        ability: systemCoreCodeSchema
      })
    )
  })
)

export { castingTimeDtoSchema } from './castingTime.js'
