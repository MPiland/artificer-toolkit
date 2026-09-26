import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { liveSessionBootstrapInputSchema } from './liveSessionState.js'
import { scenePresentationFenceSchema } from './sceneGeometry.js'
import {
  sceneDoorStateCommandInputDtoSchema,
  sceneTokenMovementCommandInputDtoSchema
} from './vttScenes.js'
import {
  resolveRuleOccurrenceInputDtoSchema,
  voidRuleOccurrenceInputDtoSchema
} from './encounterRuleCommands.js'

/** The stored geometry command supplies the authority and version fences for every raw read. */
export const liveSessionMovementCaptureScopeSchema = z.strictObject({
  encounterId: postgresUuidSchema,
  saveId: postgresUuidSchema,
  baseTokenOrdinal: z.nullable(z.number().check(z.int()).check(z.nonnegative()))
})

/**
 * Convex function arguments must be one object, so every room Scene commit starts with one shape: a
 * token move or door change fenced to the presentation that selected its Scene, or a movement
 * decision's answer or GM void (which declines it), which carries no fence.
 */
export const liveSessionMovementBeginInputSchema = z
  .extend(liveSessionBootstrapInputSchema, {
    expectedRole: z.enum(['OWNER', 'PLAYER']),
    command: z.union([
      sceneTokenMovementCommandInputDtoSchema,
      sceneDoorStateCommandInputDtoSchema,
      resolveRuleOccurrenceInputDtoSchema,
      voidRuleOccurrenceInputDtoSchema
    ]),
    presentation: z.optional(scenePresentationFenceSchema)
  })
  .check(
    z.refine(
      (input) =>
        (input.command.type === 'MOVE_SCENE_TOKEN' ||
          input.command.type === 'SET_SCENE_DOOR_STATE') ===
        (input.presentation !== undefined),
      'A Scene change requires its presentation fence and a decision answer must not carry one.'
    )
  )

export type LiveSessionMovementCaptureScope = z.infer<typeof liveSessionMovementCaptureScopeSchema>
export type LiveSessionMovementBeginInput = z.infer<typeof liveSessionMovementBeginInputSchema>
