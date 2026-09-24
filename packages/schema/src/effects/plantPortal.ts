import { z } from '../zod.js'

import { measurementUnitCodeSchema, sizeCodeSchema } from '../shared/enums.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const plantPortalDtoSchema = z.object({
  id: authoredIdentifierSchema,
  effectKind: z.literal('PLANT_PORTAL'),
  minimumPlantSize: sizeCodeSchema,
  requiresInanimatePlant: z.boolean(),
  samePlaneOnly: z.boolean(),
  destinationMustBeSeenOrTouched: z.boolean(),
  movementCost: z.object({
    amount: z.number().check(z.positive()),
    unit: measurementUnitCodeSchema
  })
})

export type PlantPortalDto = z.infer<typeof plantPortalDtoSchema>
