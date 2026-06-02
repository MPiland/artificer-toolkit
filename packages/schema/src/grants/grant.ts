import { z } from 'zod'

import { facetDtoSchema } from '../shared/facet.js'
import {
  authoringModeKindSchema,
  authoringSelectionKindSchema,
  scalingKindSchema,
} from '../shared/enums.js'

export const staticGrantBaseDtoSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  restrictions: facetDtoSchema.optional()
})

export const grantPayloadDtoSchema = z.discriminatedUnion('authoringModeKind', [
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.ALL).optional()
  }),
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED)
  })
])

export const scalingLevelDtoSchema = z.object({
  id: z.string(),
  level: z.number().int(),
  order: z.number().int()
})

export const scalingGrantBaseDtoSchema = staticGrantBaseDtoSchema.extend({
  selectionKind: authoringSelectionKindSchema,
  scalingKind: scalingKindSchema,
  count: z.number().int().optional()
}).superRefine((value, ctx) => {
  if (
    value.selectionKind === 'CHOSEN'
    && value.scalingKind === 'NONE'
    && value.count === undefined
  ) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'count is required when selectionKind is CHOSEN and scalingKind is NONE' })
  }
})

export const grantProgressionLevelDtoSchema = scalingLevelDtoSchema

export const grantProgressionDtoSchema = z.discriminatedUnion('scalingSource', [
  z.object({
    scalingSource: z.literal('CHARACTER_LEVEL'),
    levels: z.array(grantProgressionLevelDtoSchema)
  }),
  z.object({
    scalingSource: z.literal('CLASS_LEVEL'),
    classId: z.string(),
    levels: z.array(grantProgressionLevelDtoSchema)
  }),
  z.object({
    scalingSource: z.literal('PARENT_CLASS_LEVEL'),
    levels: z.array(grantProgressionLevelDtoSchema)
  }),
  z.object({
    scalingSource: z.literal('SPELL_CAST_LEVEL'),
    levels: z.array(grantProgressionLevelDtoSchema)
  })
])

export const grantProgressionFieldsDtoSchema = z.object({
  progression: grantProgressionDtoSchema.optional()
}).superRefine((value, ctx) => {
  if (!value.progression) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'progression is required when scalingKind is PER_LEVEL' })
  }
})
