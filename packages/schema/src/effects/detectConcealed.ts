import { z, lazySchema } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const detectConcealedDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('DETECT_CONCEALED')
  })
)
