import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { encounterCommandInputDtoSchema } from './encounters.js'
import { liveSessionBootstrapInputSchema } from './liveSessionState.js'

/**
 * Which room planner owns a pending occurrence. Convex derives it with the native resume
 * precedence; `NATIVE` means the room forwards the response to the Convex implementation.
 */
export const liveSessionEncounterRouteSchema = z.enum([
  'ACTION',
  'TURN',
  'CONCENTRATION',
  'MOVEMENT',
  'NATIVE'
])

export const liveSessionEncounterRouteInputSchema = z.extend(liveSessionBootstrapInputSchema, {
  encounterId: postgresUuidSchema,
  occurrenceId: postgresUuidSchema
})

export const liveSessionEncounterRouteResponseSchema = z.strictObject({
  route: liveSessionEncounterRouteSchema
})

/** An Encounter command the room forwards to its Convex implementation, in room order. */
export const liveSessionEncounterCommandInputSchema = z.extend(liveSessionBootstrapInputSchema, {
  command: encounterCommandInputDtoSchema
})

export type LiveSessionEncounterRoute = z.infer<typeof liveSessionEncounterRouteSchema>
export type LiveSessionEncounterRouteInput = z.infer<typeof liveSessionEncounterRouteInputSchema>
export type LiveSessionEncounterCommandInput = z.infer<
  typeof liveSessionEncounterCommandInputSchema
>
