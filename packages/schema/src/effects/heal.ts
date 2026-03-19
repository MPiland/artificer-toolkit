import { z } from 'zod'
import { scalingKindSchema, scalingSourceSchema } from '../shared/enums.js'
import { levelScaledValueLevelDtoSchema } from '../shared/scaling.js'

const healBonusDtoSchema = z.discriminatedUnion('bonusKind', [
  z.object({
    id: z.string(),
    bonusKind: z.literal('ABILITY_BONUS'),
    ability: z.enum(['CHARISMA', 'CONSTITUTION', 'DEXTERITY', 'INTELLIGENCE', 'STRENGTH', 'WISDOM', 'SPELLCASTING']),
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
  }),
  z.object({
    id: z.string(),
    bonusKind: z.literal('CLASS_LEVEL'),
    classId: z.string(),
    min: z.number().optional(),
    max: z.number().optional(),
    multiplier: z.number().optional(),
    order: z.number().int()
  })
])

const healFixedDtoSchema = z.union([
  z.object({
    amount: z.number(),
    valueKind: z.literal('FIXED'),
    scalingKind: z.literal(scalingKindSchema.enum.NONE)
  }),
  z.object({
    valueKind: z.literal('FIXED'),
    scalingKind: z.literal(scalingKindSchema.enum.PER_LEVEL),
    levels: z.array(levelScaledValueLevelDtoSchema.extend({ amount: z.number() })),
    scalingSource: scalingSourceSchema,
    classId: z.string().optional()
  }).superRefine((value, ctx) => {
    if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'classId is required for CLASS_LEVEL scaling' })
    }
  })
])

const healDiceDtoSchema = z.union([
  z.object({
    diceConfig: z.string(),
    valueKind: z.literal('DICE'),
    scalingKind: z.literal(scalingKindSchema.enum.NONE)
  }),
  z.object({
    valueKind: z.literal('DICE'),
    scalingKind: z.literal(scalingKindSchema.enum.PER_LEVEL),
    levels: z.array(levelScaledValueLevelDtoSchema.extend({ diceConfig: z.string() })),
    scalingSource: scalingSourceSchema,
    classId: z.string().optional()
  }).superRefine((value, ctx) => {
    if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'classId is required for CLASS_LEVEL scaling' })
    }
  })
])

const healPoolDtoSchema = z.union([
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
    max: z.number().optional(),
    temporary: z.boolean().optional()
  }).superRefine((value, ctx) => {
    if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'classId is required for CLASS_LEVEL scaling' })
    }
  })
])

export const healDtoSchema = z.object({
  id: z.string(),
  effectKind: z.literal('HEAL'),
  temporary: z.boolean().optional(),
  bonuses: z.array(healBonusDtoSchema).optional()
}).and(z.union([healFixedDtoSchema, healDiceDtoSchema, healPoolDtoSchema]))

export type HealDto = z.infer<typeof healDtoSchema>
