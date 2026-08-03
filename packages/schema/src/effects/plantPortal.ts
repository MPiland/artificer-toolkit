import { z } from 'zod'

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
    amount: z.number().positive(),
    unit: measurementUnitCodeSchema
  })
})

export type PlantPortalDto = z.infer<typeof plantPortalDtoSchema>
