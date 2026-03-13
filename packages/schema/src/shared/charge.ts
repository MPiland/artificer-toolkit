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
  z.object({
    id: z.string(),
    resetKind: chargeResetKindSchema,
    bonuses: z.array(chargeBonusDtoSchema).optional(),
    limitKind: z.enum([
      chargeLimitKindSchema.enum.CHARACTER_LEVEL,
      chargeLimitKindSchema.enum.SOURCE_LEVEL
    ]),
    scalingKind: z.literal(scalingKindSchema.enum.NONE),
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

export type ChargeBonusDto = z.infer<typeof chargeBonusDtoSchema>
export type ChargeDto = z.infer<typeof chargeDtoSchema>
