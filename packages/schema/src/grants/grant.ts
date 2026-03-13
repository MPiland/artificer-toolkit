import { z } from 'zod'

import { facetDtoSchema } from '../shared/facet.js'
import {
  authoringModeKindSchema,
  authoringSelectionKindSchema,
  scalingKindSchema,
  scalingSourceSchema
} from '../shared/enums.js'

export const staticGrantBaseDtoSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  restrictions: facetDtoSchema.optional()
})

export const grantPayloadDtoSchema = z.discriminatedUnion('authoringModeKind', [
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.ALL)
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
  count: z.number().int().optional(),
  scalingSource: scalingSourceSchema.optional(),
  classId: z.string().optional(),
  spellId: z.string().optional()
}).superRefine((value, ctx) => {
  if (value.scalingKind === 'PER_LEVEL' && !value.scalingSource) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'scalingSource is required when scalingKind is PER_LEVEL' })
  }

  if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'classId is required for CLASS_LEVEL scaling' })
  }

  if (value.scalingSource === 'SPELL_LEVEL' && !value.spellId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'spellId is required for SPELL_LEVEL scaling' })
  }
})
