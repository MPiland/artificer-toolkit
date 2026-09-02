import { z } from 'zod'

import { postgresUuidSchema } from '../shared/postgresUuid.js'

/**
 * Reduces one UUID-backed scalar without mutating its immutable base value.
 * The owning System policy interprets the terminal consequence.
 */
export const scalarReductionDtoSchema = z.strictObject({
  id: postgresUuidSchema,
  effectKind: z.literal('SCALAR_REDUCTION'),
  valueDefinitionId: postgresUuidSchema,
  amount: z.strictObject({
    kind: z.literal('DICE'),
    diceConfig: z
      .string()
      .trim()
      .regex(/^[1-9]\d{0,1}d(?:[2-9]|[1-9]\d{1,3})$/i)
  }),
  stacking: z.literal('ADDITIVE'),
  floor: z.literal(0),
  recoveryTriggers: z
    .array(z.enum(['SHORT_REST', 'LONG_REST']))
    .min(1)
    .max(2)
    .superRefine((value, context) => {
      if (new Set(value).size !== value.length)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Recovery triggers must be unique.'
        })
    }),
  terminalConsequence: z.literal('TARGET_DIED')
})

export type ScalarReductionDto = z.infer<typeof scalarReductionDtoSchema>
