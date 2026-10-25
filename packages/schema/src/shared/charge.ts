import { z, lazySchema } from '../zod.js'
import {
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
import { systemCoreCodeSchema } from './systemCoreCode.js'

export const chargeBonusDtoSchema = lazySchema(() =>
  z.union([
    z.object({
      id: authoredIdentifierSchema,
      bonusKind: z.literal(chargeBonusKindSchema._zod.def.entries.ABILITY_MODIFIER),
      ability: systemCoreCodeSchema,
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
)

const chargeFixedPerLevelDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    level: z.number().check(z.int()),
    amount: z.number()
  })
)

export const chargeDtoSchema = lazySchema(() =>
  z.union([
    z.object({
      id: authoredIdentifierSchema,
      resetKind: chargeResetKindSchema,
      bonuses: z.optional(authoredNestedCollectionSchema(chargeBonusDtoSchema)),
      limitKind: z.enum([
        chargeLimitKindSchema._zod.def.entries.CHARACTER_LEVEL,
        chargeLimitKindSchema._zod.def.entries.PARENT_CLASS_LEVEL,
        chargeLimitKindSchema._zod.def.entries.SPELL_CAST_LEVEL
      ]),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE),
      multiplier: z.optional(z.number()),
      min: z.optional(z.number()),
      max: z.optional(z.number())
    }),
    z.object({
      id: authoredIdentifierSchema,
      resetKind: chargeResetKindSchema,
      bonuses: z.optional(authoredNestedCollectionSchema(chargeBonusDtoSchema)),
      limitKind: z.literal(chargeLimitKindSchema._zod.def.entries.CLASS_LEVEL),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE),
      classId: authoredIdentifierSchema,
      multiplier: z.optional(z.number()),
      min: z.optional(z.number()),
      max: z.optional(z.number())
    }),
    z.object({
      id: authoredIdentifierSchema,
      resetKind: chargeResetKindSchema,
      bonuses: z.optional(authoredNestedCollectionSchema(chargeBonusDtoSchema)),
      limitKind: z.literal(chargeLimitKindSchema._zod.def.entries.ABILITY_MODIFIER),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE),
      ability: systemCoreCodeSchema,
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
)

export const sourceChargeDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    limitKind: z.literal(chargeLimitKindSchema._zod.def.entries.SOURCE_CHARGES),
    scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE),
    cost: z.number().check(z.int()).check(z.positive())
  })
)

export const chargeUseDtoSchema = lazySchema(() =>
  z.union([chargeDtoSchema, sourceChargeDtoSchema])
)

export type ChargeBonusDto = z.infer<typeof chargeBonusDtoSchema>
export type ChargeDto = z.infer<typeof chargeDtoSchema>
export type SourceChargeDto = z.infer<typeof sourceChargeDtoSchema>
export type ChargeUseDto = z.infer<typeof chargeUseDtoSchema>
