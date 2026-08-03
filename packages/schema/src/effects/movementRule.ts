import { z } from 'zod'

import { measurementUnitCodeSchema } from '../shared/enums.js'
import { authoredIdentifierSchema, authoredNonnegativeNumberSchema } from '../shared/authoredLimits.js'

const distanceDtoSchema = z.object({
  amount: authoredNonnegativeNumberSchema,
  unit: measurementUnitCodeSchema
})

export const movementRuleDtoSchema = z.discriminatedUnion('ruleKind', [
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('MOVEMENT_RULE'),
    ruleKind: z.literal('MOVEMENT_COST_MULTIPLIER'),
    multiplier: z.number().positive()
  }),
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('MOVEMENT_RULE'),
    ruleKind: z.literal('STOP_CURRENT_MOVEMENT')
  }),
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('MOVEMENT_RULE'),
    ruleKind: z.enum([
      'LIMIT_DISTANCE_FROM_ANCHOR',
      'MAX_FALL_DISTANCE_FROM_ANCHOR',
      'MAX_CLIMB_DISTANCE_FROM_ANCHOR'
    ]),
    limitDistance: distanceDtoSchema
  })
])
