import { z, lazySchema } from '../zod.js'
import {
  effectKindSchema,
  forcedMovementActionEconomySchema,
  forcedMovementDirectionSchema,
  forcedMovementDistanceModeSchema,
  lengthUnitCodeSchema
} from '../shared/enums.js'
import { authoredIdentifierSchema, authoredLengthAmountSchema } from '../shared/authoredLimits.js'
import { savingThrowDtoSchema } from '../shared/savingThrow.js'

export const forcedMovementCollisionDtoSchema = lazySchema(() =>
  z.strictObject({
    id: authoredIdentifierSchema,
    damageTypeId: authoredIdentifierSchema,
    diceConfig: authoredIdentifierSchema,
    savingThrow: savingThrowDtoSchema,
    conditionId: authoredIdentifierSchema
  })
)

export const forcedMovementDtoSchema = lazySchema(() =>
  z.intersection(
    z.object({
      id: authoredIdentifierSchema,
      effectKind: z.literal(effectKindSchema._zod.def.entries.FORCED_MOVEMENT),
      direction: forcedMovementDirectionSchema,
      actionEconomy: forcedMovementActionEconomySchema,
      collision: z.optional(forcedMovementCollisionDtoSchema)
    }),
    z.discriminatedUnion('distanceMode', [
      z.object({
        distanceMode: z.literal(forcedMovementDistanceModeSchema._zod.def.entries.UP_TO_SPEED)
      }),
      z.object({
        distanceMode: z.enum([
          forcedMovementDistanceModeSchema._zod.def.entries.EXACT,
          forcedMovementDistanceModeSchema._zod.def.entries.UP_TO
        ]),
        amount: authoredLengthAmountSchema,
        unit: lengthUnitCodeSchema
      })
    ])
  )
)

export type ForcedMovementDto = z.infer<typeof forcedMovementDtoSchema>
