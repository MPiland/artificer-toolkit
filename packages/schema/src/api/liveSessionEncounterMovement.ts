import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { liveSessionBootstrapInputSchema } from './liveSessionState.js'
import { sceneGeometrySessionInputSchema } from './sceneGeometry.js'
import { sceneTokenMovementCommandInputDtoSchema } from './vttScenes.js'
import { resolveRuleOccurrenceInputDtoSchema } from './encounterRuleCommands.js'

/** The stored geometry command supplies the authority and version fences for every raw read. */
export const liveSessionMovementCaptureScopeSchema = z.strictObject({
  encounterId: postgresUuidSchema,
  saveId: postgresUuidSchema,
  baseTokenOrdinal: z.nullable(z.number().check(z.int()).check(z.nonnegative()))
})

export const liveSessionMovementBeginInputSchema = z.union([
  z.extend(liveSessionBootstrapInputSchema, {
    expectedRole: z.enum(['OWNER', 'PLAYER']),
    command: sceneTokenMovementCommandInputDtoSchema,
    session: sceneGeometrySessionInputSchema
  }),
  z.extend(liveSessionBootstrapInputSchema, {
    expectedRole: z.enum(['OWNER', 'PLAYER']),
    command: resolveRuleOccurrenceInputDtoSchema
  })
])

export type LiveSessionMovementCaptureScope = z.infer<typeof liveSessionMovementCaptureScopeSchema>
export type LiveSessionMovementBeginInput = z.infer<typeof liveSessionMovementBeginInputSchema>
