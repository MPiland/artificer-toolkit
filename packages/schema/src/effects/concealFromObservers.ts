import { z, lazySchema } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const concealFromObserversDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('CONCEAL_FROM_OBSERVERS'),
    observers: z.literal('NON_ALLIES')
  })
)
