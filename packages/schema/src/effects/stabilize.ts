import { z } from 'zod'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const stabilizeDtoSchema = z.object({
  id: authoredIdentifierSchema,
  effectKind: z.literal('STABILIZE'),
  requiresZeroHitPoints: z.literal(true)
})
