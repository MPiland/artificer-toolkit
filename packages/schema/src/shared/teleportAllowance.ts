import { TELEPORT_ALLOWANCE_DESTINATION_KINDS } from '@artificer-toolkit/shared/vtt/teleportAllowanceDestinationKind'
import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from './postgresUuid.js'

/** The most teleport allowances one actor's casts can hold in a turn: one per teleport spell cast. */
export const MAX_TURN_TELEPORT_ALLOWANCES = 4

/** Whether a teleport's destination must be seen (Misty Step) or may be any point in range (Dimension Door). */
export const teleportDestinationKindSchema = lazySchema(() =>
  z.enum(TELEPORT_ALLOWANCE_DESTINATION_KINDS)
)

/** A one-shot teleport a cast granted the caster this turn: the cast, its range in feet and its destination rule. */
export const teleportAllowanceDtoSchema = lazySchema(() =>
  z.strictObject({
    castCommandId: postgresUuidSchema,
    maxFeet: z.number().check(z.int()).check(z.positive()),
    destinationKind: teleportDestinationKindSchema
  })
)
