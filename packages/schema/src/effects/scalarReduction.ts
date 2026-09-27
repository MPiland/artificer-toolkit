import { z, lazySchema } from '../zod.js'

import { postgresUuidSchema } from '../shared/postgresUuid.js'

/**
 * Reduces one UUID-backed scalar without mutating its immutable base value.
 * The owning System policy interprets the terminal consequence.
 */
export const scalarReductionDtoSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    effectKind: z.literal('SCALAR_REDUCTION'),
    valueDefinitionId: postgresUuidSchema,
    amount: z.strictObject({
      kind: z.literal('DICE'),
      diceConfig: z
        .string()
        .check(z.trim())
        .check(z.regex(/^[1-9]\d{0,1}d(?:[2-9]|[1-9]\d{1,3})$/i))
    }),
    stacking: z.literal('ADDITIVE'),
    floor: z.literal(0),
    recoveryTriggers: z
      .array(z.enum(['SHORT_REST', 'LONG_REST']))
      .check(z.minLength(1))
      .check(z.maxLength(2))
      .check(
        z.superRefine((value, context) => {
          if (new Set(value).size !== value.length)
            context.addIssue({
              code: 'custom',
              message: 'Recovery triggers must be unique.'
            })
        })
      ),
    terminalConsequence: z.literal('TARGET_DIED')
  })
)

export type ScalarReductionDto = z.infer<typeof scalarReductionDtoSchema>
