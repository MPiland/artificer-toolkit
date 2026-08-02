import { z } from 'zod'
import {
  abilityModifierReferenceSchema,
  scalingAmountKindSchema,
  scalingKindSchema,
  scalingSourceSchema
} from '../shared/enums.js'
import { levelScaledValueLevelDtoSchema } from '../shared/scaling.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema
} from '../shared/authoredLimits.js'

export const damageBonusDtoSchema = z.union([
  z.object({
    id: authoredIdentifierSchema,
    bonusKind: z.literal('ABILITY_BONUS'),
    ability: abilityModifierReferenceSchema,
    min: z.number().optional(),
    max: z.number().optional(),
    multiplier: z.number().optional(),
    order: z.number().int()
  }),
  z.object({
    id: authoredIdentifierSchema,
    bonusKind: z.literal('SKILL_BONUS'),
    skillId: authoredIdentifierSchema,
    min: z.number().optional(),
    max: z.number().optional(),
    multiplier: z.number().optional(),
    order: z.number().int()
  }),
  z.object({
    id: authoredIdentifierSchema,
    bonusKind: z.literal('PROFICIENCY_BONUS'),
    min: z.number().optional(),
    max: z.number().optional(),
    multiplier: z.number().optional(),
    order: z.number().int()
  })
])

const damageFixedDtoSchema = z.union([
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
        levelScaledValueLevelDtoSchema.extend({
          amount: z.number()
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
    }),
  z
    .object({
      valueKind: z.literal('FIXED'),
      scalingKind: z.literal('BREAKPOINTS'),
      breakpoints: authoredNestedCollectionSchema(
        levelScaledValueLevelDtoSchema.extend({
          value: z.object({
            amount: z.number()
          })
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

const damageDiceDtoSchema = z.union([
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
        levelScaledValueLevelDtoSchema.extend({
          diceConfig: authoredIdentifierSchema
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
    }),
  z
    .object({
      valueKind: z.literal('DICE'),
      scalingKind: z.literal('BREAKPOINTS'),
      breakpoints: authoredNestedCollectionSchema(
        levelScaledValueLevelDtoSchema.extend({
          value: z.object({
            diceConfig: authoredIdentifierSchema
          })
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

const damagePoolDtoSchema = z.union([
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
      max: z.number().optional()
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

export const damageDtoSchema = z
  .object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('DAMAGE'),
    damageTypeId: authoredIdentifierSchema,
    bonuses: authoredNestedCollectionSchema(damageBonusDtoSchema).optional(),
    amountKind: scalingAmountKindSchema.optional(),
    multiplier: z.number().optional()
  })
  .and(z.union([damageFixedDtoSchema, damageDiceDtoSchema, damagePoolDtoSchema]))

export type DamageDto = z.infer<typeof damageDtoSchema>
