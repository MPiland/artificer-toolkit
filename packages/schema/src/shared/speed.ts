import { z, lazySchema } from '../zod.js'
import { authoredIdentifierSchema } from './authoredLimits.js'
import { lengthUnitCodeSchema } from './enums.js'

export const speedDtoSchema = lazySchema(() =>
  z.object({
    speedId: authoredIdentifierSchema,
    amount: z.number(),
    unit: lengthUnitCodeSchema
  })
)

export type SpeedDto = z.infer<typeof speedDtoSchema>
