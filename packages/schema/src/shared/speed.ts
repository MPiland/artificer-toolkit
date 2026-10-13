import { z, lazySchema } from '../zod.js'
import { authoredIdentifierSchema, authoredLengthAmountSchema } from './authoredLimits.js'
import { lengthUnitCodeSchema } from './enums.js'

export const speedDtoSchema = lazySchema(() =>
  z.object({
    speedId: authoredIdentifierSchema,
    amount: authoredLengthAmountSchema,
    unit: lengthUnitCodeSchema
  })
)

export type SpeedDto = z.infer<typeof speedDtoSchema>
