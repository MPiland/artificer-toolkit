import { z, lazySchema } from '../zod.js'

import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema
} from '../shared/authoredLimits.js'
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
  ctx: z.core.$RefinementCtx,
  path: (string | number)[] = []
): void {
  if (value.selectionKind === 'CHOSEN') {
    if (!hasValue(value.count)) {
      ctx.addIssue({
        code: 'custom',
        path: [...path, 'count'],
        message: 'count is required when selectionKind is CHOSEN'
      })
    }

    if (!hasValue(value.selectionDuplicatePolicy)) {
      ctx.addIssue({
        code: 'custom',
        path: [...path, 'selectionDuplicatePolicy'],
        message: 'selectionDuplicatePolicy is required when selectionKind is CHOSEN'
      })
    }
  }

  if (value.selectionKind === 'GRANTED') {
    if (hasValue(value.count)) {
      ctx.addIssue({
        code: 'custom',
        path: [...path, 'count'],
        message: 'count is not allowed when selectionKind is GRANTED'
      })
    }

    if (hasValue(value.selectionDuplicatePolicy)) {
      ctx.addIssue({
        code: 'custom',
        path: [...path, 'selectionDuplicatePolicy'],
        message: 'selectionDuplicatePolicy is not allowed when selectionKind is GRANTED'
      })
    }
  }
}

export const staticGrantBaseDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    order: z.number().check(z.int()),
    restrictions: z.optional(facetDtoSchema)
  })
)

export const grantPayloadDtoSchema = lazySchema(() =>
  z.discriminatedUnion('authoringModeKind', [
    z.object({
      authoringModeKind: z.optional(z.literal(authoringModeKindSchema._zod.def.entries.ALL))
    }),
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED)
    })
  ])
)

export const scalingLevelDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    level: z.number().check(z.int()),
    order: z.number().check(z.int()),
    count: z.optional(z.number().check(z.int())),
    selectionDuplicatePolicy: z.optional(authoringSelectionDuplicatePolicySchema)
  })
)

export const scalingGrantBaseDtoSchema = lazySchema(() =>
  z
    .extend(staticGrantBaseDtoSchema, {
      selectionKind: authoringSelectionKindSchema,
      scalingKind: scalingKindSchema,
      count: z.optional(z.number().check(z.int())),
      selectionDuplicatePolicy: z.optional(authoringSelectionDuplicatePolicySchema)
    })
    .check(
      z.superRefine((value, ctx) => {
        if (value.scalingKind === 'NONE') {
          validateChosenGrantSelectionFields(value, ctx)
          return
        }

        if (value.count !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['count'],
            message: 'count belongs to progression levels when scalingKind is PER_LEVEL'
          })
        }

        if (value.selectionDuplicatePolicy !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['selectionDuplicatePolicy'],
            message:
              'selectionDuplicatePolicy belongs to progression levels when scalingKind is PER_LEVEL'
          })
        }
      })
    )
)

export const grantProgressionLevelDtoSchema = scalingLevelDtoSchema

export function createGrantProgressionFieldsDtoSchema<TPayload extends z.ZodMiniType>(
  levelPayloadSchema: TPayload
) {
  const levelSchema = z.intersection(grantProgressionLevelDtoSchema, levelPayloadSchema)

  return z.object({
    progression: z.discriminatedUnion('scalingSource', [
      z.object({
        scalingSource: z.literal('CHARACTER_LEVEL'),
        levels: authoredNestedCollectionSchema(levelSchema)
      }),
      z.object({
        scalingSource: z.literal('CLASS_LEVEL'),
        classId: authoredIdentifierSchema,
        levels: authoredNestedCollectionSchema(levelSchema)
      }),
      z.object({
        scalingSource: z.literal('PARENT_CLASS_LEVEL'),
        levels: authoredNestedCollectionSchema(levelSchema)
      }),
      z.object({
        scalingSource: z.literal('SPELL_CAST_LEVEL'),
        levels: authoredNestedCollectionSchema(levelSchema)
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
  ctx: z.core.$RefinementCtx
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
