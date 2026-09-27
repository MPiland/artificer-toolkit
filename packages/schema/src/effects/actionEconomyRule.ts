import { z, lazySchema } from '../zod.js'
import {
  authoredIdentifierSchema,
  authoredNonnegativeNumberSchema
} from '../shared/authoredLimits.js'

export const actionEconomyRuleDtoSchema = lazySchema(() =>
  z.intersection(
    z.object({
      id: authoredIdentifierSchema,
      effectKind: z.literal('ACTION_ECONOMY_RULE')
    }),
    z.discriminatedUnion('ruleKind', [
      z.object({ ruleKind: z.literal('LOSE_ACTION') }),
      z.object({
        ruleKind: z.enum(['MAX_ATTACKS_PER_ACTIVATION', 'MAX_ATTACKS_PER_TURN']),
        maximum: authoredNonnegativeNumberSchema
      })
    ])
  )
)
