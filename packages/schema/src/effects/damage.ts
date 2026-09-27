import { z } from '../zod.js'
import {
  abilityModifierReferenceSchema,
  scalingAmountKindSchema,
  scalingKindSchema,
  scalingSourceSchema
} from '../shared/enums.js'
import { levelScaledValueLevelDtoSchema } from '../shared/scaling.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredNonnegativeNumberSchema
} from '../shared/authoredLimits.js'

export const damageBonusDtoSchema = z.union([
  z.object({
    id: authoredIdentifierSchema,
    bonusKind: z.literal('ABILITY_BONUS'),
    ability: abilityModifierReferenceSchema,
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

const damageFixedDtoSchema = z.union([
  z.object({
    amount: authoredNonnegativeNumberSchema,
    valueKind: z.literal('FIXED'),
    scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE)
  }),
  z
    .object({
      valueKind: z.literal('FIXED'),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.PER_LEVEL),
      levels: authoredNestedCollectionSchema(
        z.extend(levelScaledValueLevelDtoSchema, {
          amount: authoredNonnegativeNumberSchema
        })
      ),
      scalingSource: scalingSourceSchema,
      classId: z.optional(authoredIdentifierSchema)
    })
    .check(
      z.superRefine((value, ctx) => {
        if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
          ctx.addIssue({
            code: 'custom',
            message: 'classId is required for CLASS_LEVEL scaling'
          })
        }
      })
    ),
  z
    .object({
      valueKind: z.literal('FIXED'),
      scalingKind: z.literal('BREAKPOINTS'),
      breakpoints: authoredNestedCollectionSchema(
        z.extend(levelScaledValueLevelDtoSchema, {
          value: z.object({
            amount: authoredNonnegativeNumberSchema
          })
        })
      ),
      scalingSource: scalingSourceSchema,
      classId: z.optional(authoredIdentifierSchema)
    })
    .check(
      z.superRefine((value, ctx) => {
        if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
          ctx.addIssue({
            code: 'custom',
            message: 'classId is required for CLASS_LEVEL scaling'
          })
        }
      })
    )
])

const damageDiceDtoSchema = z.union([
  z.object({
    diceConfig: authoredIdentifierSchema,
    halfHitPointsDiceConfig: z.optional(authoredIdentifierSchema),
    valueKind: z.literal('DICE'),
    scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE)
  }),
  z
    .object({
      valueKind: z.literal('DICE'),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.PER_LEVEL),
      levels: authoredNestedCollectionSchema(
        z.extend(levelScaledValueLevelDtoSchema, {
          diceConfig: authoredIdentifierSchema
        })
      ),
      scalingSource: scalingSourceSchema,
      classId: z.optional(authoredIdentifierSchema)
    })
    .check(
      z.superRefine((value, ctx) => {
        if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
          ctx.addIssue({
            code: 'custom',
            message: 'classId is required for CLASS_LEVEL scaling'
          })
        }
      })
    ),
  z
    .object({
      valueKind: z.literal('DICE'),
      scalingKind: z.literal('BREAKPOINTS'),
      breakpoints: authoredNestedCollectionSchema(
        z.extend(levelScaledValueLevelDtoSchema, {
          value: z.object({
            diceConfig: authoredIdentifierSchema
          })
        })
      ),
      scalingSource: scalingSourceSchema,
      classId: z.optional(authoredIdentifierSchema)
    })
    .check(
      z.superRefine((value, ctx) => {
        if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
          ctx.addIssue({
            code: 'custom',
            message: 'classId is required for CLASS_LEVEL scaling'
          })
        }
      })
    )
])

const damagePoolDtoSchema = z.union([
  z.object({
    amount: authoredNonnegativeNumberSchema,
    valueKind: z.literal('POOL'),
    scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE)
  }),
  z
    .object({
      valueKind: z.literal('POOL'),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.PER_LEVEL),
      scalingSource: scalingSourceSchema,
      classId: z.optional(authoredIdentifierSchema),
      amount: z.optional(authoredNonnegativeNumberSchema),
      multiplier: z.optional(authoredNonnegativeNumberSchema),
      min: z.optional(authoredNonnegativeNumberSchema),
      max: z.optional(authoredNonnegativeNumberSchema)
    })
    .check(
      z.superRefine((value, ctx) => {
        if (value.scalingSource === 'CLASS_LEVEL' && !value.classId) {
          ctx.addIssue({
            code: 'custom',
            message: 'classId is required for CLASS_LEVEL scaling'
          })
        }
      })
    )
])

export const damageDtoSchema = z.intersection(
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('DAMAGE'),
    damageTypeId: authoredIdentifierSchema,
    bonuses: z.optional(authoredNestedCollectionSchema(damageBonusDtoSchema)),
    amountKind: z.optional(scalingAmountKindSchema),
    multiplier: z.optional(authoredNonnegativeNumberSchema)
  }),
  z.union([damageFixedDtoSchema, damageDiceDtoSchema, damagePoolDtoSchema])
)

export type DamageDto = z.infer<typeof damageDtoSchema>
