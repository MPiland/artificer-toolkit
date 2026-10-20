import { z, lazySchema } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const restoreResourceDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('RESTORE_RESOURCE'),
    chargeId: authoredIdentifierSchema,
    floor: z.number().check(z.int()).check(z.gte(1)),
    whenAtOrBelow: z.number().check(z.int()).check(z.gte(0))
  })
)

export type RestoreResourceDto = z.infer<typeof restoreResourceDtoSchema>
