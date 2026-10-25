import { z, lazySchema } from '../zod.js'
import { authoredIdentifierSchema, authoredNestedCollectionSchema } from './authoredLimits.js'
import { systemCoreCodeSchema } from './systemCoreCode.js'

const numericExprCodeSchema = lazySchema(() =>
  z.enum([
    'FIXED',
    'ADD',
    'MUL',
    'CLAMP',
    'PROFICIENCY_BONUS',
    'ABILITY_MODIFIER',
    'SKILL_BONUS',
    'CHARACTER_LEVEL',
    'CLASS_LEVEL',
    'SPELL_LEVEL',
    'HIT_POINT_MAXIMUM'
  ])
)

const numericAtomSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('FIXED'),
      value: z.number()
    }),
    z.object({
      kind: z.literal('PROFICIENCY_BONUS')
    }),
    z.object({
      kind: z.literal('ABILITY_MODIFIER'),
      ability: systemCoreCodeSchema
    }),
    z.object({
      kind: z.literal('SKILL_BONUS'),
      skillId: authoredIdentifierSchema
    }),
    z.object({
      kind: z.literal('CHARACTER_LEVEL')
    }),
    z.object({
      kind: z.literal('CLASS_LEVEL'),
      classId: z.optional(authoredIdentifierSchema)
    }),
    z.object({
      kind: z.literal('SPELL_LEVEL')
    }),
    z.object({
      kind: z.literal('HIT_POINT_MAXIMUM')
    })
  ])
)

const numericMulSchema = lazySchema(() =>
  z.object({
    kind: z.literal('MUL'),
    left: numericAtomSchema,
    right: numericAtomSchema
  })
)

const numericTermSchema = lazySchema(() => z.union([numericAtomSchema, numericMulSchema]))

const numericAddSchema = lazySchema(() =>
  z.object({
    kind: z.literal('ADD'),
    args: authoredNestedCollectionSchema(numericTermSchema).check(z.minLength(1))
  })
)

export const numericExprSchema: z.ZodMiniType = lazySchema(() =>
  z.lazy(() =>
    z.discriminatedUnion('kind', [
      ...numericAtomSchema._zod.def.options,
      numericMulSchema,
      numericAddSchema,
      z.object({
        kind: z.literal('CLAMP'),
        value: z.union([numericAddSchema, numericTermSchema]),
        min: z.optional(z.number()),
        max: z.optional(z.number())
      })
    ])
  )
)

export type NumericExprDto = z.infer<typeof numericExprSchema>
export type NumericExprCodeDto = z.infer<typeof numericExprCodeSchema>
