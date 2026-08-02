import { z } from 'zod'
import { authoredIdentifierSchema } from './authoredLimits.js'

export const speedDtoSchema = z.object({
  speedId: authoredIdentifierSchema,
  amount: z.number(),
  unit: authoredIdentifierSchema
})

export type SpeedDto = z.infer<typeof speedDtoSchema>
