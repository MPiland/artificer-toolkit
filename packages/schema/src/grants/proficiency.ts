import { z } from 'zod'

import { staticGrantBaseDtoSchema } from './grant.js'
import {
  authoringModeKindSchema,
  authoringSelectionKindSchema,
  proficiencyKindSchema,
  roundingCodeSchema,
  scalingAmountKindSchema
} from '../shared/enums.js'

const proficiencyScalingDtoSchema = z.union([
  z.object({
    level: z.literal(scalingAmountKindSchema.enum.HALF),
    rounding: roundingCodeSchema
  }),
  z.object({
    level: z.enum([
      scalingAmountKindSchema.enum.DOUBLE,
      scalingAmountKindSchema.enum.FULL
    ])
  })
])

const allTargetDtoSchema = z.object({
  authoringModeKind: z.literal(authoringModeKindSchema.enum.ALL).optional()
})

const skillTargetDtoSchema = z.union([
  allTargetDtoSchema,
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    skillIds: z.array(z.string())
  })
])

const saveAbilityTargetDtoSchema = z.union([
  allTargetDtoSchema,
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    abilities: z.array(z.string())
  })
])

const languageTargetDtoSchema = z.union([
  allTargetDtoSchema,
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    languageIds: z.array(z.string())
  })
])

const equipmentTargetDtoSchema = z.union([
  allTargetDtoSchema.extend({
    category: z.string().optional(),
    properties: z.array(z.string()).optional()
  }),
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    equipmentIds: z.array(z.string()),
    category: z.string().optional(),
    properties: z.array(z.string()).optional()
  })
])

const equipmentPropertyTargetDtoSchema = z.union([
  allTargetDtoSchema.extend({
    category: z.string().optional()
  }),
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    properties: z.array(z.string()),
    category: z.string().optional()
  })
])

export const proficiencyGrantDtoSchema = staticGrantBaseDtoSchema.extend({
  grantKind: z.literal('PROFICIENCY_GRANT'),
  selectionKind: authoringSelectionKindSchema,
  count: z.number().int().optional()
}).and(z.union([
  z.object({
    proficiencyKind: z.literal(proficiencyKindSchema.enum.SKILL)
  }).and(skillTargetDtoSchema),
  z.object({
    proficiencyKind: z.literal(proficiencyKindSchema.enum.SAVE_ABILITY)
  }).and(saveAbilityTargetDtoSchema),
  z.object({
    proficiencyKind: z.literal(proficiencyKindSchema.enum.LANGUAGE)
  }).and(languageTargetDtoSchema),
  z.object({
    proficiencyKind: z.literal(proficiencyKindSchema.enum.EQUIPMENT)
  }).and(equipmentTargetDtoSchema),
  z.object({
    proficiencyKind: z.literal(proficiencyKindSchema.enum.EQUIPMENT_PROPERTY)
  }).and(equipmentPropertyTargetDtoSchema)
])).and(proficiencyScalingDtoSchema)

export type ProficiencyGrantDto = z.infer<typeof proficiencyGrantDtoSchema>
