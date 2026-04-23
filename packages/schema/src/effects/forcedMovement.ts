import { z } from 'zod'
import {
  effectKindSchema,
  forcedMovementActionEconomySchema,
  forcedMovementDirectionSchema,
  forcedMovementDistanceModeSchema,
  measurementUnitCodeSchema
} from '../shared/enums.js'

export const forcedMovementDtoSchema = z.object({
  id: z.string(),
  effectKind: z.literal(effectKindSchema.enum.FORCED_MOVEMENT),
  direction: forcedMovementDirectionSchema,
  actionEconomy: forcedMovementActionEconomySchema
}).and(z.discriminatedUnion('distanceMode', [
  z.object({
    distanceMode: z.literal(forcedMovementDistanceModeSchema.enum.UP_TO_SPEED)
  }),
  z.object({
    distanceMode: z.literal(forcedMovementDistanceModeSchema.enum.FIXED_DISTANCE),
    amount: z.number(),
    unit: measurementUnitCodeSchema
  })
]))

export type ForcedMovementDto = z.infer<typeof forcedMovementDtoSchema>
