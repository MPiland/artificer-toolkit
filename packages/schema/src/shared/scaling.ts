import { z, lazySchema } from '../zod.js'
import { scalingSourceSchema } from './enums.js'
import { authoredIdentifierSchema, authoredNestedCollectionSchema } from './authoredLimits.js'

export const levelScaledValueLevelDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    level: z.number().check(z.int()),
    order: z.number().check(z.int())
  })
)

export const levelScaledValueDtoSchema = lazySchema(() =>
  z.discriminatedUnion('scalingSource', [
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
)

export type LevelScaledValueDto = z.infer<typeof levelScaledValueDtoSchema>

export const scalingBreakpointDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    level: z.number().check(z.int()),
    order: z.number().check(z.int())
  })
)

export const createBreakpointScalingDtoSchema = <TValue extends z.ZodMiniType>(
  valueSchema: TValue
) =>
  z.discriminatedUnion('scalingSource', [
    z.object({
      scalingKind: z.literal('BREAKPOINTS'),
      scalingSource: z.literal(scalingSourceSchema._zod.def.entries.CHARACTER_LEVEL),
      breakpoints: authoredNestedCollectionSchema(
        z.extend(scalingBreakpointDtoSchema, {
          value: valueSchema
        })
      )
    }),
    z.object({
      scalingKind: z.literal('BREAKPOINTS'),
      scalingSource: z.literal(scalingSourceSchema._zod.def.entries.CLASS_LEVEL),
      classId: authoredIdentifierSchema,
      breakpoints: authoredNestedCollectionSchema(
        z.extend(scalingBreakpointDtoSchema, {
          value: valueSchema
        })
      )
    }),
    z.object({
      scalingKind: z.literal('BREAKPOINTS'),
      scalingSource: z.literal(scalingSourceSchema._zod.def.entries.PARENT_CLASS_LEVEL),
      breakpoints: authoredNestedCollectionSchema(
        z.extend(scalingBreakpointDtoSchema, {
          value: valueSchema
        })
      )
    }),
    z.object({
      scalingKind: z.literal('BREAKPOINTS'),
      scalingSource: z.literal(scalingSourceSchema._zod.def.entries.SPELL_CAST_LEVEL),
      breakpoints: authoredNestedCollectionSchema(
        z.extend(scalingBreakpointDtoSchema, {
          value: valueSchema
        })
      )
    })
  ])
