import { z } from 'zod'

import { measurementUnitCodeSchema } from '../shared/enums.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

const positiveMeasurementDtoSchema = z.object({
  amount: z.number().positive(),
  unit: measurementUnitCodeSchema
})

export const treeStrideDtoSchema = z.object({
  id: authoredIdentifierSchema,
  effectKind: z.literal('TREE_STRIDE'),
  destinationDistance: positiveMeasurementDtoSchema,
  entryMovementCost: positiveMeasurementDtoSchema,
  exitMovementCost: positiveMeasurementDtoSchema,
  sameTreeKind: z.boolean(),
  livingTreesOnly: z.boolean(),
  minimumTreeSizeRelativeToTraveler: z.boolean(),
  usesPerRound: z.number().int().positive(),
  mustEndTurnOutside: z.boolean()
})

export type TreeStrideDto = z.infer<typeof treeStrideDtoSchema>
