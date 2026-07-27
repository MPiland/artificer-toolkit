import { z } from 'zod'

import { facetDtoSchema } from '../shared/facet.js'
import {
  authoringModeKindSchema,
  authoringSelectionDuplicatePolicySchema,
  authoringSelectionKindSchema,
  scalingKindSchema
} from '../shared/enums.js'

type SelectionPolicyCandidate = {
  selectionKind?: string
  count?: unknown
  selectionDuplicatePolicy?: unknown
}

function hasValue(value: unknown): boolean {
  return value !== undefined
}

export function validateChosenGrantSelectionFields(
  value: SelectionPolicyCandidate,
  ctx: z.RefinementCtx,
  path: (string | number)[] = []
): void {
  if (value.selectionKind === 'CHOSEN') {
    if (!hasValue(value.count)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'count'],
        message: 'count is required when selectionKind is CHOSEN'
      })
    }

    if (!hasValue(value.selectionDuplicatePolicy)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'selectionDuplicatePolicy'],
        message: 'selectionDuplicatePolicy is required when selectionKind is CHOSEN'
      })
    }
  }

  if (value.selectionKind === 'GRANTED') {
    if (hasValue(value.count)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'count'],
        message: 'count is not allowed when selectionKind is GRANTED'
      })
    }

    if (hasValue(value.selectionDuplicatePolicy)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'selectionDuplicatePolicy'],
        message: 'selectionDuplicatePolicy is not allowed when selectionKind is GRANTED'
      })
    }
  }
}

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
  order: z.number().int(),
  count: z.number().int().optional(),
  selectionDuplicatePolicy: authoringSelectionDuplicatePolicySchema.optional()
})

export const scalingGrantBaseDtoSchema = staticGrantBaseDtoSchema
  .extend({
    selectionKind: authoringSelectionKindSchema,
    scalingKind: scalingKindSchema,
    count: z.number().int().optional(),
    selectionDuplicatePolicy: authoringSelectionDuplicatePolicySchema.optional()
  })
  .superRefine((value, ctx) => {
    if (value.scalingKind === 'NONE') {
      validateChosenGrantSelectionFields(value, ctx)
      return
    }

    if (value.count !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['count'],
        message: 'count belongs to progression levels when scalingKind is PER_LEVEL'
      })
    }

    if (value.selectionDuplicatePolicy !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selectionDuplicatePolicy'],
        message:
          'selectionDuplicatePolicy belongs to progression levels when scalingKind is PER_LEVEL'
      })
    }
  })

export const grantProgressionLevelDtoSchema = scalingLevelDtoSchema

export function createGrantProgressionFieldsDtoSchema<TPayload extends z.ZodType>(
  levelPayloadSchema: TPayload
) {
  const levelSchema = grantProgressionLevelDtoSchema.and(levelPayloadSchema)

  return z.object({
    progression: z.discriminatedUnion('scalingSource', [
      z.object({
        scalingSource: z.literal('CHARACTER_LEVEL'),
        levels: z.array(levelSchema)
      }),
      z.object({
        scalingSource: z.literal('CLASS_LEVEL'),
        classId: z.string(),
        levels: z.array(levelSchema)
      }),
      z.object({
        scalingSource: z.literal('PARENT_CLASS_LEVEL'),
        levels: z.array(levelSchema)
      }),
      z.object({
        scalingSource: z.literal('SPELL_CAST_LEVEL'),
        levels: z.array(levelSchema)
      })
    ])
  })
}

export function validateGrantProgressionSelectionFields(
  value: {
    selectionKind?: string
    scalingKind?: string
    progression?: { levels?: SelectionPolicyCandidate[] }
  },
  ctx: z.RefinementCtx
): void {
  if (value.scalingKind !== 'PER_LEVEL' || !value.progression?.levels) {
    return
  }

  value.progression.levels.forEach((level, index) => {
    validateChosenGrantSelectionFields({ ...level, selectionKind: value.selectionKind }, ctx, [
      'progression',
      'levels',
      index
    ])
  })
}
