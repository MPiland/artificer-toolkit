import { z } from '../zod.js'
import {
  effectKindSchema,
  forcedMovementActionEconomySchema,
  forcedMovementDirectionSchema,
  forcedMovementDistanceModeSchema,
  measurementUnitCodeSchema
} from '../shared/enums.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const forcedMovementDtoSchema = z.intersection(
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal(effectKindSchema._zod.def.entries.FORCED_MOVEMENT),
    direction: forcedMovementDirectionSchema,
    actionEconomy: forcedMovementActionEconomySchema
  }),
  z.discriminatedUnion('distanceMode', [
    z.object({
      distanceMode: z.literal(forcedMovementDistanceModeSchema._zod.def.entries.UP_TO_SPEED)
    }),
    z.object({
      distanceMode: z.literal(forcedMovementDistanceModeSchema._zod.def.entries.FIXED_DISTANCE),
      amount: z.number(),
      unit: measurementUnitCodeSchema
    })
  ])
)

export type ForcedMovementDto = z.infer<typeof forcedMovementDtoSchema>
