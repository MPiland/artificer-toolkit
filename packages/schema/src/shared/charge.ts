import { z } from 'zod'
import {
  abilityCodeSchema,
  chargeBonusKindSchema,
  chargeLimitKindSchema,
  chargeResetKindSchema,
  scalingKindSchema
} from './enums.js'

export const chargeBonusDtoSchema = z.union([
  z.object({
    id: z.string(),
    bonusKind: z.literal(chargeBonusKindSchema.enum.ABILITY_MODIFIER),
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

const chargeFixedPerLevelDtoSchema = z.object({
  id: z.string(),
  level: z.number().int(),
  amount: z.number()
})

export const chargeDtoSchema = z.union([
  z
    .object({
      id: z.string(),
      resetKind: chargeResetKindSchema,
      bonuses: z.array(chargeBonusDtoSchema).optional(),
      limitKind: z.enum([
        chargeLimitKindSchema.enum.CHARACTER_LEVEL,
        chargeLimitKindSchema.enum.CLASS_LEVEL,
        chargeLimitKindSchema.enum.PARENT_CLASS_LEVEL,
        chargeLimitKindSchema.enum.SPELL_CAST_LEVEL
      ]),
      scalingKind: z.literal(scalingKindSchema.enum.NONE),
      classId: z.string().optional(),
      multiplier: z.number().optional(),
      min: z.number().optional(),
      max: z.number().optional()
    })
    .superRefine((value, ctx) => {
      if (value.limitKind === 'CLASS_LEVEL' && !value.classId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'classId is required for CLASS_LEVEL charge limits'
        })
      }
    }),
  z.object({
    id: z.string(),
    resetKind: chargeResetKindSchema,
    bonuses: z.array(chargeBonusDtoSchema).optional(),
    limitKind: z.literal(chargeLimitKindSchema.enum.ABILITY_MODIFIER),
    scalingKind: z.literal(scalingKindSchema.enum.NONE),
    ability: abilityCodeSchema,
    multiplier: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional()
  }),
  z.object({
    id: z.string(),
    resetKind: chargeResetKindSchema,
    bonuses: z.array(chargeBonusDtoSchema).optional(),
    limitKind: z.literal(chargeLimitKindSchema.enum.FIXED_AMOUNT),
    scalingKind: z.literal(scalingKindSchema.enum.NONE),
    amount: z.number()
  }),
  z.object({
    id: z.string(),
    resetKind: chargeResetKindSchema,
    bonuses: z.array(chargeBonusDtoSchema).optional(),
    limitKind: z.literal(chargeLimitKindSchema.enum.FIXED_AMOUNT),
    scalingKind: z.literal(scalingKindSchema.enum.PER_LEVEL),
    levels: z.array(chargeFixedPerLevelDtoSchema)
  })
])

export const sourceChargeDtoSchema = z.object({
  id: z.string(),
  limitKind: z.literal(chargeLimitKindSchema.enum.SOURCE_CHARGES),
  scalingKind: z.literal(scalingKindSchema.enum.NONE),
  cost: z.number().int().positive()
})

export const chargeUseDtoSchema = z.union([chargeDtoSchema, sourceChargeDtoSchema])

export type ChargeBonusDto = z.infer<typeof chargeBonusDtoSchema>
export type ChargeDto = z.infer<typeof chargeDtoSchema>
export type SourceChargeDto = z.infer<typeof sourceChargeDtoSchema>
export type ChargeUseDto = z.infer<typeof chargeUseDtoSchema>
