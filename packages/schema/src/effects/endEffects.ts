import { z, lazySchema } from '../zod.js'

import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema
} from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

export const endEffectsDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('END_EFFECTS'),
    scope: z.enum(['ALL', 'ONE_CHOSEN']),
    conditionIds: authoredNestedCollectionSchema(postgresUuidSchema).check(z.minLength(1))
  })
)
