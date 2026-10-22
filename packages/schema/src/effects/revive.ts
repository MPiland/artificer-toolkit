import { z, lazySchema } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const reviveDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('REVIVE'),
    hitPoints: z.enum(['ONE', 'MAXIMUM'])
  })
)
