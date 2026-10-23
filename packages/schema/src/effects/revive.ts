import { z, lazySchema } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const reviveDtoSchema = lazySchema(() =>
  z.union([
    z.object({
      id: authoredIdentifierSchema,
      effectKind: z.literal('REVIVE'),
      valueKind: z.literal('FIXED'),
      amount: z.number().check(z.int(), z.gte(1))
    }),
    z.object({
      id: authoredIdentifierSchema,
      effectKind: z.literal('REVIVE'),
      valueKind: z.literal('MAXIMUM')
    })
  ])
)
