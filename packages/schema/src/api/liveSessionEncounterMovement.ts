import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { liveSessionBootstrapInputSchema } from './liveSessionState.js'
import { scenePresentationFenceSchema } from './sceneGeometry.js'
import { sceneTokenMovementCommandInputDtoSchema } from './vttScenes.js'
import { resolveRuleOccurrenceInputDtoSchema } from './encounterRuleCommands.js'

/** The stored geometry command supplies the authority and version fences for every raw read. */
export const liveSessionMovementCaptureScopeSchema = z.strictObject({
  encounterId: postgresUuidSchema,
  saveId: postgresUuidSchema,
  baseTokenOrdinal: z.nullable(z.number().check(z.int()).check(z.nonnegative()))
})

/**
 * Convex function arguments must be one object, so the initial move and a response share one shape.
 * A move is fenced to the presentation that selected its Scene; a response carries no fence.
 */
export const liveSessionMovementBeginInputSchema = z
  .extend(liveSessionBootstrapInputSchema, {
    expectedRole: z.enum(['OWNER', 'PLAYER']),
    command: z.union([sceneTokenMovementCommandInputDtoSchema, resolveRuleOccurrenceInputDtoSchema]),
    presentation: z.optional(scenePresentationFenceSchema)
  })
  .check(
    z.refine(
      (input) => (input.command.type === 'MOVE_SCENE_TOKEN') === (input.presentation !== undefined),
      'A movement requires its presentation fence and a response must not carry one.'
    )
  )

export type LiveSessionMovementCaptureScope = z.infer<typeof liveSessionMovementCaptureScopeSchema>
export type LiveSessionMovementBeginInput = z.infer<typeof liveSessionMovementBeginInputSchema>
