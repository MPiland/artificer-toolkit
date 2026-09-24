import { z } from '../zod.js'
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
    bonusKind: z.literal(chargeBonusKindSchema._zod.def.entries.ABILITY_MODIFIER),
    ability: abilityCodeSchema,
    min: z.optional(authoredNonnegativeNumberSchema),
    max: z.optional(authoredNonnegativeNumberSchema),
    multiplier: z.optional(authoredNonnegativeNumberSchema),
    order: z.number().check(z.int())
  }),
  z.object({
    id: authoredIdentifierSchema,
    bonusKind: z.literal('SKILL_BONUS'),
    skillId: authoredIdentifierSchema,
    min: z.optional(authoredNonnegativeNumberSchema),
    max: z.optional(authoredNonnegativeNumberSchema),
    multiplier: z.optional(authoredNonnegativeNumberSchema),
    order: z.number().check(z.int())
  }),
  z.object({
    id: authoredIdentifierSchema,
    bonusKind: z.literal('PROFICIENCY_BONUS'),
    min: z.optional(authoredNonnegativeNumberSchema),
    max: z.optional(authoredNonnegativeNumberSchema),
    multiplier: z.optional(authoredNonnegativeNumberSchema),
    order: z.number().check(z.int())
  })
])

const chargeFixedPerLevelDtoSchema = z.object({
  id: authoredIdentifierSchema,
  level: z.number().check(z.int()),
  amount: z.number()
})

export const chargeDtoSchema = z.union([
  z
    .object({
      id: authoredIdentifierSchema,
      resetKind: chargeResetKindSchema,
      bonuses: z.optional(authoredNestedCollectionSchema(chargeBonusDtoSchema)),
      limitKind: z.enum([
        chargeLimitKindSchema._zod.def.entries.CHARACTER_LEVEL,
        chargeLimitKindSchema._zod.def.entries.CLASS_LEVEL,
        chargeLimitKindSchema._zod.def.entries.PARENT_CLASS_LEVEL,
        chargeLimitKindSchema._zod.def.entries.SPELL_CAST_LEVEL
      ]),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE),
      classId: z.optional(authoredIdentifierSchema),
      multiplier: z.optional(z.number()),
      min: z.optional(z.number()),
      max: z.optional(z.number())
    })
    .check(
      z.superRefine((value, ctx) => {
        if (value.limitKind === 'CLASS_LEVEL' && !value.classId) {
          ctx.addIssue({
            code: 'custom',
            message: 'classId is required for CLASS_LEVEL charge limits'
          })
        }
      })
    ),
  z.object({
    id: authoredIdentifierSchema,
    resetKind: chargeResetKindSchema,
    bonuses: z.optional(authoredNestedCollectionSchema(chargeBonusDtoSchema)),
    limitKind: z.literal(chargeLimitKindSchema._zod.def.entries.ABILITY_MODIFIER),
    scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE),
    ability: abilityCodeSchema,
    multiplier: z.optional(z.number()),
    min: z.optional(z.number()),
    max: z.optional(z.number())
  }),
  z.object({
    id: authoredIdentifierSchema,
    resetKind: chargeResetKindSchema,
    bonuses: z.optional(authoredNestedCollectionSchema(chargeBonusDtoSchema)),
    limitKind: z.literal(chargeLimitKindSchema._zod.def.entries.FIXED_AMOUNT),
    scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE),
    amount: z.number()
  }),
  z.object({
    id: authoredIdentifierSchema,
    resetKind: chargeResetKindSchema,
    bonuses: z.optional(authoredNestedCollectionSchema(chargeBonusDtoSchema)),
    limitKind: z.literal(chargeLimitKindSchema._zod.def.entries.FIXED_AMOUNT),
    scalingKind: z.literal(scalingKindSchema._zod.def.entries.PER_LEVEL),
    levels: authoredNestedCollectionSchema(chargeFixedPerLevelDtoSchema)
  })
])

export const sourceChargeDtoSchema = z.object({
  id: authoredIdentifierSchema,
  limitKind: z.literal(chargeLimitKindSchema._zod.def.entries.SOURCE_CHARGES),
  scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE),
  cost: z.number().check(z.int()).check(z.positive())
})

export const chargeUseDtoSchema = z.union([chargeDtoSchema, sourceChargeDtoSchema])

export type ChargeBonusDto = z.infer<typeof chargeBonusDtoSchema>
export type ChargeDto = z.infer<typeof chargeDtoSchema>
export type SourceChargeDto = z.infer<typeof sourceChargeDtoSchema>
export type ChargeUseDto = z.infer<typeof chargeUseDtoSchema>
