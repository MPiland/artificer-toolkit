import { z, lazySchema } from '../zod.js'

import { effectKindSchema, measurementUnitCodeSchema } from '../shared/enums.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const moveManifestDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal(effectKindSchema._zod.def.entries.MOVE_MANIFEST),
    manifestId: authoredIdentifierSchema,
    amount: z.number(),
    unit: measurementUnitCodeSchema,
    upTo: z.optional(z.boolean())
  })
)
