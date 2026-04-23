import { z } from 'zod'

import { effectKindSchema, measurementUnitCodeSchema } from '../shared/enums.js'

export const moveManifestDtoSchema = z.object({
  id: z.string(),
  effectKind: z.literal(effectKindSchema.enum.MOVE_MANIFEST),
  manifestId: z.string(),
  amount: z.number(),
  unit: measurementUnitCodeSchema
})
