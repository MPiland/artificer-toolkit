import { z } from 'zod'

import { staticGrantBaseDtoSchema, validateChosenGrantSelectionFields } from './grant.js'
import {
  authoredIdentifierSchema,
  authoredReferenceCollectionSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import {
  authoringModeKindSchema,
  authoringSelectionDuplicatePolicySchema,
  authoringSelectionKindSchema,
  proficiencyKindSchema,
  roundingCodeSchema,
  scalingKindSchema,
  scalingAmountKindSchema
} from '../shared/enums.js'

const proficiencyScalingDtoSchema = z.union([
  z.object({
    level: z.literal(scalingAmountKindSchema.enum.HALF),
    rounding: roundingCodeSchema
  }),
  z.object({
    level: z.enum([scalingAmountKindSchema.enum.DOUBLE, scalingAmountKindSchema.enum.FULL])
  })
])

const allTargetDtoSchema = z.object({
  authoringModeKind: z.literal(authoringModeKindSchema.enum.ALL).optional()
})

const skillTargetDtoSchema = z.union([
  allTargetDtoSchema,
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    skillIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
  })
])

const saveAbilityTargetDtoSchema = z.union([
  allTargetDtoSchema,
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    abilities: authoredReferenceCollectionSchema(authoredIdentifierSchema)
  })
])

const languageTargetDtoSchema = z.union([
  allTargetDtoSchema,
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    languageIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
  })
])

const equipmentTargetDtoSchema = z.union([
  allTargetDtoSchema.extend({
    category: authoredIdentifierSchema.optional(),
    properties: authoredReferenceCollectionSchema(authoredShortTextSchema).optional()
  }),
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    equipmentIds: authoredReferenceCollectionSchema(authoredIdentifierSchema),
    category: authoredIdentifierSchema.optional(),
    properties: authoredReferenceCollectionSchema(authoredShortTextSchema).optional()
  })
])

const equipmentPropertyTargetDtoSchema = z.union([
  allTargetDtoSchema.extend({
    category: authoredIdentifierSchema.optional()
  }),
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    properties: authoredReferenceCollectionSchema(authoredShortTextSchema),
    category: authoredIdentifierSchema.optional()
  })
])

export const proficiencyGrantDtoSchema = staticGrantBaseDtoSchema
  .extend({
    grantKind: z.literal('PROFICIENCY_GRANT'),
    selectionKind: authoringSelectionKindSchema,
    scalingKind: z.literal(scalingKindSchema.enum.NONE),
    count: z.number().int().optional(),
    selectionDuplicatePolicy: authoringSelectionDuplicatePolicySchema.optional()
  })
  .and(
    z.union([
      z
        .object({
          proficiencyKind: z.literal(proficiencyKindSchema.enum.SKILL)
        })
        .and(skillTargetDtoSchema),
      z
        .object({
          proficiencyKind: z.literal(proficiencyKindSchema.enum.SAVE_ABILITY)
        })
        .and(saveAbilityTargetDtoSchema),
      z
        .object({
          proficiencyKind: z.literal(proficiencyKindSchema.enum.LANGUAGE)
        })
        .and(languageTargetDtoSchema),
      z
        .object({
          proficiencyKind: z.literal(proficiencyKindSchema.enum.EQUIPMENT)
        })
        .and(equipmentTargetDtoSchema),
      z
        .object({
          proficiencyKind: z.literal(proficiencyKindSchema.enum.EQUIPMENT_PROPERTY)
        })
        .and(equipmentPropertyTargetDtoSchema)
    ])
  )
  .and(proficiencyScalingDtoSchema)
  .superRefine(validateChosenGrantSelectionFields)

export type ProficiencyGrantDto = z.infer<typeof proficiencyGrantDtoSchema>
