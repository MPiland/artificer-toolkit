import { z } from 'zod'
import { authoredIdentifierSchema } from './authoredLimits.js'
import { measurementUnitCodeSchema } from './enums.js'

export const speedDtoSchema = z.object({
  speedId: authoredIdentifierSchema,
  amount: z.number(),
  unit: measurementUnitCodeSchema
})

export type SpeedDto = z.infer<typeof speedDtoSchema>
