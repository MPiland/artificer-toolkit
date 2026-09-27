import { z, lazySchema } from '../zod.js'
import { encounterCommandResultDtoSchema } from './encounterData.js'
import { encounterCommandInputDtoSchema } from './encounters.js'
import {
  bindEncounterToPresentedSceneInputDtoSchema,
  bindEncounterToPresentedSceneResultDtoSchema,
  campaignSceneStateDtoSchema,
  sceneCommandInputDtoSchema,
  sceneCommandResultDtoSchema
} from './vttScenes.js'

const uuidSchema = lazySchema(() => z.string().check(z.uuid()))
export const liveSessionSequenceDtoSchema = lazySchema(() =>
  z.number().check(z.int()).check(z.nonnegative()).check(z.lte(Number.MAX_SAFE_INTEGER))
)

/**
 * Scene commands change the room's live projection; Encounter commands are planned by the room and
 * committed by Convex before acknowledgement. Encounter-bound token moves stay Scene-scoped here:
 * the room recognizes the binding and runs the Encounter movement rules for them. The GM binds an
 * Encounter to the presented Scene through the room too (D47), which commits it to Convex first.
 */
export const liveSessionCommandDtoSchema = lazySchema(() =>
  z.discriminatedUnion('scope', [
    z.strictObject({ scope: z.literal('SCENE'), command: sceneCommandInputDtoSchema }),
    z.strictObject({ scope: z.literal('ENCOUNTER'), command: encounterCommandInputDtoSchema }),
    z.strictObject({
      scope: z.literal('ENCOUNTER_BINDING'),
      command: bindEncounterToPresentedSceneInputDtoSchema
    })
  ])
)

export const liveSessionRecipientStateDtoSchema = lazySchema(() =>
  z.strictObject({
    recipientRole: z.enum(['OWNER', 'PLAYER']),
    scene: z.nullable(campaignSceneStateDtoSchema)
  })
)

export const liveSessionRecipientDeltaDtoSchema = lazySchema(() =>
  z.discriminatedUnion('scope', [
    z.strictObject({ scope: z.literal('SCENE'), result: sceneCommandResultDtoSchema }),
    // Sent only to the initiator; other recipients converge through Convex subscriptions.
    z.strictObject({ scope: z.literal('ENCOUNTER'), result: encounterCommandResultDtoSchema }),
    // Sent to every member: the Scene's Encounter binding is Campaign-visible.
    z.strictObject({
      scope: z.literal('ENCOUNTER_BINDING'),
      result: bindEncounterToPresentedSceneResultDtoSchema
    }),
    z.strictObject({
      scope: z.literal('SCENE_VERSION'),
      sceneId: uuidSchema,
      version: liveSessionSequenceDtoSchema
    })
  ])
)

export const liveSessionCorrectionDtoSchema = lazySchema(() =>
  z.strictObject({
    scope: z.literal('SCENE'),
    state: campaignSceneStateDtoSchema
  })
)

export const liveSessionCommandRejectionCodeDtoSchema = lazySchema(() =>
  z.enum([
    'AUTHORITY_CHANGED',
    'DOMAIN_REJECTED',
    'FORBIDDEN',
    'INVALID_COMMAND',
    'SESSION_CLOSED',
    'STALE_SEQUENCE',
    'STALE_STATE',
    'UNAVAILABLE'
  ])
)

/**
 * The `UNAVAILABLE` message when Convex could not answer in time, for example a read past its time
 * limit: nothing changed, so the same command can be sent again. Genuine staleness stays
 * `STALE_STATE`.
 */
export const LIVE_SESSION_TRY_AGAIN_MESSAGE = 'The table is busy right now; try again.'

export type LiveSessionCommandDto = z.infer<typeof liveSessionCommandDtoSchema>
export type LiveSessionRecipientStateDto = z.infer<typeof liveSessionRecipientStateDtoSchema>
export type LiveSessionRecipientDeltaDto = z.infer<typeof liveSessionRecipientDeltaDtoSchema>
export type LiveSessionCorrectionDto = z.infer<typeof liveSessionCorrectionDtoSchema>
export type LiveSessionCommandRejectionCodeDto = z.infer<
  typeof liveSessionCommandRejectionCodeDtoSchema
>
