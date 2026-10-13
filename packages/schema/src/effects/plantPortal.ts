import { z, lazySchema } from '../zod.js'

import { lengthUnitCodeSchema, sizeCodeSchema } from '../shared/enums.js'
import {
  authoredIdentifierSchema,
  authoredPositiveLengthAmountSchema
} from '../shared/authoredLimits.js'

export const plantPortalDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('PLANT_PORTAL'),
    minimumPlantSize: sizeCodeSchema,
    requiresInanimatePlant: z.boolean(),
    samePlaneOnly: z.boolean(),
    destinationMustBeSeenOrTouched: z.boolean(),
    movementCost: z.object({
      amount: authoredPositiveLengthAmountSchema,
      unit: lengthUnitCodeSchema
    })
  })
)

export type PlantPortalDto = z.infer<typeof plantPortalDtoSchema>
