import { z, lazySchema } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const sourceImmunityDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('SOURCE_IMMUNITY'),
    lifetime: z.optional(z.literal('CONCENTRATION'))
  })
)
