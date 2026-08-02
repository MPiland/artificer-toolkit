import { z } from 'zod'
import { scalingSourceSchema } from './enums.js'
import { authoredIdentifierSchema, authoredNestedCollectionSchema } from './authoredLimits.js'

export const levelScaledValueLevelDtoSchema = z.object({
  id: authoredIdentifierSchema,
  level: z.number().int(),
  order: z.number().int()
})

export const levelScaledValueDtoSchema = z.discriminatedUnion('scalingSource', [
  z.object({
    scalingSource: z.literal('CHARACTER_LEVEL'),
    levels: authoredNestedCollectionSchema(levelScaledValueLevelDtoSchema)
  }),
  z.object({
    scalingSource: z.literal('CLASS_LEVEL'),
    classId: authoredIdentifierSchema,
    levels: authoredNestedCollectionSchema(levelScaledValueLevelDtoSchema)
  }),
  z.object({
    scalingSource: z.literal('PARENT_CLASS_LEVEL'),
    levels: authoredNestedCollectionSchema(levelScaledValueLevelDtoSchema)
  }),
  z.object({
    scalingSource: z.literal('SPELL_CAST_LEVEL'),
    levels: authoredNestedCollectionSchema(levelScaledValueLevelDtoSchema)
  })
])

export type LevelScaledValueDto = z.infer<typeof levelScaledValueDtoSchema>

export const scalingBreakpointDtoSchema = z.object({
  id: authoredIdentifierSchema,
  level: z.number().int(),
  order: z.number().int()
})

export const createBreakpointScalingDtoSchema = <TValue extends z.ZodTypeAny>(
  valueSchema: TValue
) =>
  z.discriminatedUnion('scalingSource', [
    z.object({
      scalingKind: z.literal('BREAKPOINTS'),
      scalingSource: z.literal(scalingSourceSchema.enum.CHARACTER_LEVEL),
      breakpoints: authoredNestedCollectionSchema(
        scalingBreakpointDtoSchema.extend({
          value: valueSchema
        })
      )
    }),
    z.object({
      scalingKind: z.literal('BREAKPOINTS'),
      scalingSource: z.literal(scalingSourceSchema.enum.CLASS_LEVEL),
      classId: authoredIdentifierSchema,
      breakpoints: authoredNestedCollectionSchema(
        scalingBreakpointDtoSchema.extend({
          value: valueSchema
        })
      )
    }),
    z.object({
      scalingKind: z.literal('BREAKPOINTS'),
      scalingSource: z.literal(scalingSourceSchema.enum.PARENT_CLASS_LEVEL),
      breakpoints: authoredNestedCollectionSchema(
        scalingBreakpointDtoSchema.extend({
          value: valueSchema
        })
      )
    }),
    z.object({
      scalingKind: z.literal('BREAKPOINTS'),
      scalingSource: z.literal(scalingSourceSchema.enum.SPELL_CAST_LEVEL),
      breakpoints: authoredNestedCollectionSchema(
        scalingBreakpointDtoSchema.extend({
          value: valueSchema
        })
      )
    })
  ])
