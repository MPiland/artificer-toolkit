import { z } from 'zod'
import {
  authoredIdentifierSchema,
  authoredNonnegativeNumberSchema
} from '../shared/authoredLimits.js'

export const actionEconomyRuleDtoSchema = z
  .object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('ACTION_ECONOMY_RULE')
  })
  .and(
    z.discriminatedUnion('ruleKind', [
      z.object({ ruleKind: z.literal('LOSE_ACTION') }),
      z.object({
        ruleKind: z.enum(['MAX_ATTACKS_PER_ACTIVATION', 'MAX_ATTACKS_PER_TURN']),
        maximum: authoredNonnegativeNumberSchema
      })
    ])
  )
