import { z, lazySchema, lazySchemaParts } from '../zod.js'
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

/** One union rather than an intersection: an intersection drops a nested strict-object rejection (an unknown key in `collision`). */
const forcedMovementFields = lazySchemaParts(() => ({
  id: authoredIdentifierSchema,
  effectKind: z.literal(effectKindSchema._zod.def.entries.FORCED_MOVEMENT),
  direction: forcedMovementDirectionSchema,
  actionEconomy: forcedMovementActionEconomySchema,
  collision: z.optional(forcedMovementCollisionDtoSchema)
}))

export const forcedMovementDtoSchema = lazySchema(() =>
  z.discriminatedUnion('distanceMode', [
    z.object({
      ...forcedMovementFields(),
      distanceMode: z.literal(forcedMovementDistanceModeSchema._zod.def.entries.UP_TO_SPEED)
    }),
    z.object({
      ...forcedMovementFields(),
      distanceMode: z.enum([
        forcedMovementDistanceModeSchema._zod.def.entries.EXACT,
        forcedMovementDistanceModeSchema._zod.def.entries.UP_TO
      ]),
      amount: authoredLengthAmountSchema,
      unit: lengthUnitCodeSchema
    })
  ])
)

export type ForcedMovementDto = z.infer<typeof forcedMovementDtoSchema>
