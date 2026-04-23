import { z } from 'zod'
import {
  abilityCodeSchema,
  scalingAmountKindSchema,
  scalingKindSchema,
  scalingSourceSchema
} from '../shared/enums.js'
import { levelScaledValueLevelDtoSchema } from '../shared/scaling.js'

export const damageBonusDtoSchema = z.union([
  z.object({
    id: z.string(),
    bonusKind: z.literal('ABILITY_BONUS'),
    ability: abilityCodeSchema,
    min: z.number().optional(),
    max: z.number().optional(),
    multiplier: z.number().optional(),
    order: z.number().int()
  }),
  z.object({
    id: z.string(),
    bonusKind: z.literal('SKILL_BONUS'),
    skillId: z.string(),
    min: z.number().optional(),
    max: z.number().optional(),
    multiplier: z.number().optional(),
    order: z.number().int()
  }),
  z.object({
    id: z.string(),
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
  z.object({
    valueKind: z.literal('FIXED'),
    scalingKind: z.literal(scalingKindSchema.enum.PER_LEVEL),
    levels: z.array(
      levelScaledValueLevelDtoSchema.extend({
        amount: z.number()
      })
    ),
    scalingSource: scalingSourceSchema,
    classId: z.string().optional()
  }).superRefine((value, ctx) => {
    if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'classId is required for CLASS_LEVEL scaling' })
    }
  })
  ,
  z.object({
    valueKind: z.literal('FIXED'),
    scalingKind: z.literal('BREAKPOINTS'),
    breakpoints: z.array(
      levelScaledValueLevelDtoSchema.extend({
        value: z.object({
          amount: z.number()
        })
      })
    ),
    scalingSource: scalingSourceSchema,
    classId: z.string().optional()
  }).superRefine((value, ctx) => {
    if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'classId is required for CLASS_LEVEL scaling' })
    }
  })
])

const damageDiceDtoSchema = z.union([
  z.object({
    diceConfig: z.string(),
    valueKind: z.literal('DICE'),
    scalingKind: z.literal(scalingKindSchema.enum.NONE)
  }),
  z.object({
    valueKind: z.literal('DICE'),
    scalingKind: z.literal(scalingKindSchema.enum.PER_LEVEL),
    levels: z.array(
      levelScaledValueLevelDtoSchema.extend({
        diceConfig: z.string()
      })
    ),
    scalingSource: scalingSourceSchema,
    classId: z.string().optional()
  }).superRefine((value, ctx) => {
    if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'classId is required for CLASS_LEVEL scaling' })
    }
  })
  ,
  z.object({
    valueKind: z.literal('DICE'),
    scalingKind: z.literal('BREAKPOINTS'),
    breakpoints: z.array(
      levelScaledValueLevelDtoSchema.extend({
        value: z.object({
          diceConfig: z.string()
        })
      })
    ),
    scalingSource: scalingSourceSchema,
    classId: z.string().optional()
  }).superRefine((value, ctx) => {
    if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'classId is required for CLASS_LEVEL scaling' })
    }
  })
])

const damagePoolDtoSchema = z.union([
  z.object({
    amount: z.number(),
    valueKind: z.literal('POOL'),
    scalingKind: z.literal(scalingKindSchema.enum.NONE)
  }),
  z.object({
    valueKind: z.literal('POOL'),
    scalingKind: z.literal(scalingKindSchema.enum.PER_LEVEL),
    scalingSource: scalingSourceSchema,
    classId: z.string().optional(),
    amount: z.number().optional(),
    multiplier: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional()
  }).superRefine((value, ctx) => {
    if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'classId is required for CLASS_LEVEL scaling' })
    }
  })
])

export const damageDtoSchema = z.object({
  id: z.string(),
  effectKind: z.literal('DAMAGE'),
  damageTypeId: z.string(),
  bonuses: z.array(damageBonusDtoSchema).optional(),
  amountKind: scalingAmountKindSchema.optional(),
  multiplier: z.number().optional()
}).and(z.union([damageFixedDtoSchema, damageDiceDtoSchema, damagePoolDtoSchema]))

export type DamageDto = z.infer<typeof damageDtoSchema>
