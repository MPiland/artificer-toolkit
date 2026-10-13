import { z, lazySchema } from '../zod.js'

import { lengthUnitCodeSchema } from '../shared/enums.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

const positiveMeasurementDtoSchema = lazySchema(() =>
  z.object({
    amount: z.number().check(z.positive()),
    unit: lengthUnitCodeSchema
  })
)

export const treeStrideDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('TREE_STRIDE'),
    destinationDistance: positiveMeasurementDtoSchema,
    entryMovementCost: positiveMeasurementDtoSchema,
    exitMovementCost: positiveMeasurementDtoSchema,
    sameTreeKind: z.boolean(),
    livingTreesOnly: z.boolean(),
    minimumTreeSizeRelativeToTraveler: z.boolean(),
    usesPerRound: z.number().check(z.int()).check(z.positive()),
    mustEndTurnOutside: z.boolean()
  })
)

export type TreeStrideDto = z.infer<typeof treeStrideDtoSchema>
