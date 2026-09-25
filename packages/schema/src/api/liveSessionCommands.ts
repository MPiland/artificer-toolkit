import { z } from '../zod.js'
import { encounterCommandResultDtoSchema } from './encounterData.js'
import { encounterCommandInputDtoSchema } from './encounters.js'
import {
  campaignSceneStateDtoSchema,
  sceneCommandInputDtoSchema,
  sceneCommandResultDtoSchema
} from './vttScenes.js'

const uuidSchema = z.string().check(z.uuid())
export const liveSessionSequenceDtoSchema = z
  .number()
  .check(z.int())
  .check(z.nonnegative())
  .check(z.lte(Number.MAX_SAFE_INTEGER))

/**
 * Scene commands change the room's live projection; Encounter commands are planned by the room and
 * committed by Convex before acknowledgement. Encounter-bound token moves stay Scene-scoped here:
 * the room recognizes the binding and runs the Encounter movement rules for them.
 */
export const liveSessionCommandDtoSchema = z.discriminatedUnion('scope', [
  z.strictObject({ scope: z.literal('SCENE'), command: sceneCommandInputDtoSchema }),
  z.strictObject({ scope: z.literal('ENCOUNTER'), command: encounterCommandInputDtoSchema })
])

export const liveSessionRecipientStateDtoSchema = z.strictObject({
  recipientRole: z.enum(['OWNER', 'PLAYER']),
  scene: z.nullable(campaignSceneStateDtoSchema)
})

export const liveSessionRecipientDeltaDtoSchema = z.discriminatedUnion('scope', [
  z.strictObject({ scope: z.literal('SCENE'), result: sceneCommandResultDtoSchema }),
  // Sent only to the initiator; other recipients converge through Convex subscriptions.
  z.strictObject({ scope: z.literal('ENCOUNTER'), result: encounterCommandResultDtoSchema }),
  z.strictObject({
    scope: z.literal('SCENE_VERSION'),
    sceneId: uuidSchema,
    version: liveSessionSequenceDtoSchema
  })
])

export const liveSessionCorrectionDtoSchema = z.strictObject({
  scope: z.literal('SCENE'),
  state: campaignSceneStateDtoSchema
})

export const liveSessionCommandRejectionCodeDtoSchema = z.enum([
  'AUTHORITY_CHANGED',
  'FORBIDDEN',
  'INVALID_COMMAND',
  'SESSION_CLOSED',
  'STALE_SEQUENCE',
  'STALE_STATE',
  'UNAVAILABLE'
])

export type LiveSessionCommandDto = z.infer<typeof liveSessionCommandDtoSchema>
export type LiveSessionRecipientStateDto = z.infer<typeof liveSessionRecipientStateDtoSchema>
export type LiveSessionRecipientDeltaDto = z.infer<typeof liveSessionRecipientDeltaDtoSchema>
export type LiveSessionCorrectionDto = z.infer<typeof liveSessionCorrectionDtoSchema>
export type LiveSessionCommandRejectionCodeDto = z.infer<
  typeof liveSessionCommandRejectionCodeDtoSchema
>
