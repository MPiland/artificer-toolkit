import { z, lazySchema } from '../zod.js'

import { effectKindSchema, lengthUnitCodeSchema } from '../shared/enums.js'
import { authoredIdentifierSchema, authoredLengthAmountSchema } from '../shared/authoredLimits.js'

export const moveManifestDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal(effectKindSchema._zod.def.entries.MOVE_MANIFEST),
    manifestId: authoredIdentifierSchema,
    amount: authoredLengthAmountSchema,
    unit: lengthUnitCodeSchema,
    upTo: z.optional(z.boolean())
  })
)
