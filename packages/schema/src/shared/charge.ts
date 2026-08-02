import { z } from 'zod'
import {
  abilityCodeSchema,
  chargeBonusKindSchema,
  chargeLimitKindSchema,
  chargeResetKindSchema,
  scalingKindSchema
} from './enums.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredNonnegativeNumberSchema
} from './authoredLimits.js'

export const chargeBonusDtoSchema = z.union([
  z.object({
    id: authoredIdentifierSchema,
    bonusKind: z.literal(chargeBonusKindSchema.enum.ABILITY_MODIFIER),
    ability: abilityCodeSchema,
    min: authoredNonnegativeNumberSchema.optional(),
    max: authoredNonnegativeNumberSchema.optional(),
    multiplier: authoredNonnegativeNumberSchema.optional(),
    order: z.number().int()
  }),
  z.object({
    id: authoredIdentifierSchema,
    bonusKind: z.literal('SKILL_BONUS'),
    skillId: authoredIdentifierSchema,
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
  })
])

const chargeFixedPerLevelDtoSchema = z.object({
  id: authoredIdentifierSchema,
  level: z.number().int(),
  amount: z.number()
})

export const chargeDtoSchema = z.union([
  z
    .object({
      id: authoredIdentifierSchema,
      resetKind: chargeResetKindSchema,
      bonuses: authoredNestedCollectionSchema(chargeBonusDtoSchema).optional(),
      limitKind: z.enum([
        chargeLimitKindSchema.enum.CHARACTER_LEVEL,
        chargeLimitKindSchema.enum.CLASS_LEVEL,
        chargeLimitKindSchema.enum.PARENT_CLASS_LEVEL,
        chargeLimitKindSchema.enum.SPELL_CAST_LEVEL
      ]),
      scalingKind: z.literal(scalingKindSchema.enum.NONE),
      classId: authoredIdentifierSchema.optional(),
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
    id: authoredIdentifierSchema,
    resetKind: chargeResetKindSchema,
    bonuses: authoredNestedCollectionSchema(chargeBonusDtoSchema).optional(),
    limitKind: z.literal(chargeLimitKindSchema.enum.ABILITY_MODIFIER),
    scalingKind: z.literal(scalingKindSchema.enum.NONE),
    ability: abilityCodeSchema,
    multiplier: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional()
  }),
  z.object({
    id: authoredIdentifierSchema,
    resetKind: chargeResetKindSchema,
    bonuses: authoredNestedCollectionSchema(chargeBonusDtoSchema).optional(),
    limitKind: z.literal(chargeLimitKindSchema.enum.FIXED_AMOUNT),
    scalingKind: z.literal(scalingKindSchema.enum.NONE),
    amount: z.number()
  }),
  z.object({
    id: authoredIdentifierSchema,
    resetKind: chargeResetKindSchema,
    bonuses: authoredNestedCollectionSchema(chargeBonusDtoSchema).optional(),
    limitKind: z.literal(chargeLimitKindSchema.enum.FIXED_AMOUNT),
    scalingKind: z.literal(scalingKindSchema.enum.PER_LEVEL),
    levels: authoredNestedCollectionSchema(chargeFixedPerLevelDtoSchema)
  })
])

export const sourceChargeDtoSchema = z.object({
  id: authoredIdentifierSchema,
  limitKind: z.literal(chargeLimitKindSchema.enum.SOURCE_CHARGES),
  scalingKind: z.literal(scalingKindSchema.enum.NONE),
  cost: z.number().int().positive()
})

export const chargeUseDtoSchema = z.union([chargeDtoSchema, sourceChargeDtoSchema])

export type ChargeBonusDto = z.infer<typeof chargeBonusDtoSchema>
export type ChargeDto = z.infer<typeof chargeDtoSchema>
export type SourceChargeDto = z.infer<typeof sourceChargeDtoSchema>
export type ChargeUseDto = z.infer<typeof chargeUseDtoSchema>
