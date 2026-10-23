import { z, lazySchema } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const removeFromPlayDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('REMOVE_FROM_PLAY'),
    keepsTurn: z.boolean()
  })
)
