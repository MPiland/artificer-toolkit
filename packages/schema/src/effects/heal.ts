import { z, lazySchema } from '../zod.js'
import { scalingKindSchema, scalingSourceSchema } from '../shared/enums.js'
import { levelScaledValueLevelDtoSchema } from '../shared/scaling.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredNonnegativeNumberSchema
} from '../shared/authoredLimits.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

/** A fixed amount's bonus: an ability modifier, the proficiency bonus or a class level, bounded and scaled. */
export const amountBonusDtoSchema = lazySchema(() =>
  z.discriminatedUnion('bonusKind', [
    z.object({
      id: authoredIdentifierSchema,
      bonusKind: z.literal('ABILITY_BONUS'),
      ability: systemCoreCodeSchema,
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
    }),
    z.object({
      id: authoredIdentifierSchema,
      bonusKind: z.literal('CLASS_LEVEL'),
      classId: authoredIdentifierSchema,
      min: z.optional(authoredNonnegativeNumberSchema),
      max: z.optional(authoredNonnegativeNumberSchema),
      multiplier: z.optional(authoredNonnegativeNumberSchema),
      order: z.number().check(z.int())
    })
  ])
)

const healFixedDtoSchema = lazySchema(() =>
  z.union([
    z.object({
      amount: z.number(),
      valueKind: z.literal('FIXED'),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE)
    }),
    z
      .object({
        valueKind: z.literal('FIXED'),
        scalingKind: z.literal(scalingKindSchema._zod.def.entries.PER_LEVEL),
        levels: authoredNestedCollectionSchema(
          z.extend(levelScaledValueLevelDtoSchema, { amount: z.number() })
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
          z.extend(levelScaledValueLevelDtoSchema, { value: z.object({ amount: z.number() }) })
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
)

const healDiceDtoSchema = lazySchema(() =>
  z.union([
    z.object({
      diceConfig: authoredIdentifierSchema,
      valueKind: z.literal('DICE'),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE)
    }),
    z
      .object({
        valueKind: z.literal('DICE'),
        scalingKind: z.literal(scalingKindSchema._zod.def.entries.PER_LEVEL),
        levels: authoredNestedCollectionSchema(
          z.extend(levelScaledValueLevelDtoSchema, { diceConfig: authoredIdentifierSchema })
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
            value: z.object({ diceConfig: authoredIdentifierSchema })
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
)

/** A positive whole-number fraction. */
const healFractionSchema = lazySchema(() =>
  z.strictObject({
    numerator: z.number().check(z.int(), z.positive()),
    denominator: z.number().check(z.int(), z.positive())
  })
)

/**
 * Who splits a pool heal's amount among the creatures it reaches: the caster divides it as they
 * choose, and `splitCeiling` caps what each creature may be restored to as a fraction of its
 * hit point maximum.
 */
const healSplitShape = () => ({
  splitKind: z.optional(z.literal('CASTER_DIVIDES')),
  splitCeiling: z.optional(healFractionSchema)
})

const healPoolDtoSchema = lazySchema(() =>
  z.union([
    z.object({
      amount: z.number(),
      valueKind: z.literal('POOL'),
      scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE),
      ...healSplitShape()
    }),
    z
      .object({
        valueKind: z.literal('POOL'),
        scalingKind: z.literal(scalingKindSchema._zod.def.entries.PER_LEVEL),
        scalingSource: scalingSourceSchema,
        classId: z.optional(authoredIdentifierSchema),
        amount: z.optional(z.number()),
        multiplier: z.optional(z.number()),
        min: z.optional(z.number()),
        max: z.optional(z.number()),
        temporary: z.optional(z.boolean()),
        ...healSplitShape()
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
)

/** Hit points regained for each unit the caster spends from the action's resource pool. */
const healResourceSpentDtoSchema = lazySchema(() =>
  z.object({
    amount: z.number().check(z.positive()),
    valueKind: z.literal('RESOURCE_SPENT'),
    scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE)
  })
)

const healDamageDealtDtoSchema = lazySchema(() =>
  z.object({
    valueKind: z.literal('DAMAGE_DEALT'),
    scalingKind: z.literal(scalingKindSchema._zod.def.entries.NONE),
    damageOutcomeId: postgresUuidSchema,
    fraction: healFractionSchema,
    recipient: z.literal('SOURCE')
  })
)

export const healDtoSchema = lazySchema(() =>
  z.intersection(
    z.object({
      id: authoredIdentifierSchema,
      effectKind: z.literal('HEAL'),
      temporary: z.optional(z.boolean()),
      bonuses: z.optional(authoredNestedCollectionSchema(amountBonusDtoSchema))
    }),
    z.union([
      healFixedDtoSchema,
      healDiceDtoSchema,
      healPoolDtoSchema,
      healResourceSpentDtoSchema,
      healDamageDealtDtoSchema
    ])
  )
)

export type HealDto = z.infer<typeof healDtoSchema>
