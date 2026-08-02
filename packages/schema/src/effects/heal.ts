import { z } from 'zod'
import {
  abilityModifierReferenceSchema,
  scalingKindSchema,
  scalingSourceSchema
} from '../shared/enums.js'
import { levelScaledValueLevelDtoSchema } from '../shared/scaling.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredNonnegativeNumberSchema
} from '../shared/authoredLimits.js'

const healBonusDtoSchema = z.discriminatedUnion('bonusKind', [
  z.object({
    id: authoredIdentifierSchema,
    bonusKind: z.literal('ABILITY_BONUS'),
    ability: abilityModifierReferenceSchema,
    min: authoredNonnegativeNumberSchema.optional(),
    max: authoredNonnegativeNumberSchema.optional(),
    multiplier: authoredNonnegativeNumberSchema.optional(),
    order: z.number().int()
  }),
  z.object({
    id: authoredIdentifierSchema,
    bonusKind: z.literal('PROFICIENCY_BONUS'),
    min: authoredNonnegativeNumberSchema.optional(),
    max: authoredNonnegativeNumberSchema.optional(),
    multiplier: authoredNonnegativeNumberSchema.optional(),
    order: z.number().int()
  }),
  z.object({
    id: authoredIdentifierSchema,
    bonusKind: z.literal('CLASS_LEVEL'),
    classId: authoredIdentifierSchema,
    min: authoredNonnegativeNumberSchema.optional(),
    max: authoredNonnegativeNumberSchema.optional(),
    multiplier: authoredNonnegativeNumberSchema.optional(),
    order: z.number().int()
  })
])

const healFixedDtoSchema = z.union([
  z.object({
    amount: z.number(),
    valueKind: z.literal('FIXED'),
    scalingKind: z.literal(scalingKindSchema.enum.NONE)
  }),
  z
    .object({
      valueKind: z.literal('FIXED'),
      scalingKind: z.literal(scalingKindSchema.enum.PER_LEVEL),
      levels: authoredNestedCollectionSchema(
        levelScaledValueLevelDtoSchema.extend({ amount: z.number() })
      ),
      scalingSource: scalingSourceSchema,
      classId: authoredIdentifierSchema.optional()
    })
    .superRefine((value, ctx) => {
      if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'classId is required for CLASS_LEVEL scaling'
        })
      }
    }),
  z
    .object({
      valueKind: z.literal('FIXED'),
      scalingKind: z.literal('BREAKPOINTS'),
      breakpoints: authoredNestedCollectionSchema(
        levelScaledValueLevelDtoSchema.extend({ value: z.object({ amount: z.number() }) })
      ),
      scalingSource: scalingSourceSchema,
      classId: authoredIdentifierSchema.optional()
    })
    .superRefine((value, ctx) => {
      if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'classId is required for CLASS_LEVEL scaling'
        })
      }
    })
])

const healDiceDtoSchema = z.union([
  z.object({
    diceConfig: authoredIdentifierSchema,
    valueKind: z.literal('DICE'),
    scalingKind: z.literal(scalingKindSchema.enum.NONE)
  }),
  z
    .object({
      valueKind: z.literal('DICE'),
      scalingKind: z.literal(scalingKindSchema.enum.PER_LEVEL),
      levels: authoredNestedCollectionSchema(
        levelScaledValueLevelDtoSchema.extend({ diceConfig: authoredIdentifierSchema })
      ),
      scalingSource: scalingSourceSchema,
      classId: authoredIdentifierSchema.optional()
    })
    .superRefine((value, ctx) => {
      if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'classId is required for CLASS_LEVEL scaling'
        })
      }
    }),
  z
    .object({
      valueKind: z.literal('DICE'),
      scalingKind: z.literal('BREAKPOINTS'),
      breakpoints: authoredNestedCollectionSchema(
        levelScaledValueLevelDtoSchema.extend({
          value: z.object({ diceConfig: authoredIdentifierSchema })
        })
      ),
      scalingSource: scalingSourceSchema,
      classId: authoredIdentifierSchema.optional()
    })
    .superRefine((value, ctx) => {
      if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'classId is required for CLASS_LEVEL scaling'
        })
      }
    })
])

const healPoolDtoSchema = z.union([
  z.object({
    amount: z.number(),
    valueKind: z.literal('POOL'),
    scalingKind: z.literal(scalingKindSchema.enum.NONE)
  }),
  z
    .object({
      valueKind: z.literal('POOL'),
      scalingKind: z.literal(scalingKindSchema.enum.PER_LEVEL),
      scalingSource: scalingSourceSchema,
      classId: authoredIdentifierSchema.optional(),
      amount: z.number().optional(),
      multiplier: z.number().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      temporary: z.boolean().optional()
    })
    .superRefine((value, ctx) => {
      if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'classId is required for CLASS_LEVEL scaling'
        })
      }
    })
])

export const healDtoSchema = z
  .object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('HEAL'),
    temporary: z.boolean().optional(),
    bonuses: authoredNestedCollectionSchema(healBonusDtoSchema).optional()
  })
  .and(z.union([healFixedDtoSchema, healDiceDtoSchema, healPoolDtoSchema]))

export type HealDto = z.infer<typeof healDtoSchema>
