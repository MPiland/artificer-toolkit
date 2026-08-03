import { z } from 'zod'

import { effectKindSchema, measurementUnitCodeSchema } from '../shared/enums.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const moveManifestDtoSchema = z.object({
  id: authoredIdentifierSchema,
  effectKind: z.literal(effectKindSchema.enum.MOVE_MANIFEST),
  manifestId: authoredIdentifierSchema,
  amount: z.number(),
  unit: measurementUnitCodeSchema,
  upTo: z.boolean().optional()
})
