import { z, lazySchema } from '../zod.js'
import { encounterCommandResultDtoSchema } from './encounterData.js'
import { encounterCommandInputDtoSchema } from './encounters.js'
import { characterSheetLivePlayCommandSchema } from './characterSheetLiveCommands.js'
import { characterSheetCommandResponseDtoSchema } from './characterSheetCommands.js'
import { campaignChatEntryDtoSchema } from './campaignCommunication.js'
import { campaignChatLiveCommandSchema } from './campaignChatLiveCommands.js'
import {
  bindEncounterToPresentedSceneInputDtoSchema,
  bindEncounterToPresentedSceneResultDtoSchema,
  campaignSceneStateDtoSchema,
  encounterActorTokenBindingCommandInputDtoSchema,
  sceneCommandInputDtoSchema,
  sceneCommandResultDtoSchema
} from './vttScenes.js'
import { sceneFogPublishCommandInputSchema } from './sceneFog.js'

const uuidSchema = lazySchema(() => z.string().check(z.uuid()))
export const liveSessionSequenceDtoSchema = lazySchema(() =>
  z.number().check(z.int()).check(z.nonnegative()).check(z.lte(Number.MAX_SAFE_INTEGER))
)

/**
 * Scene and Encounter commands, including the GM's actor-token bindings, commit in the room's
 * SQLite (D78). The GM's fog painting stages through `SCENE_FOG_BEGIN`/`SCENE_FOG_APPEND` and
 * commits with `PUBLISH_SCENE_FOG_PATCH`; a full-layer `PATCH_SCENE_FOG` is never sent live (D79). Bound token moves stay Scene-scoped here: the room recognizes the binding and runs
 * the Encounter movement rules for them. The GM binds an Encounter to the presented Scene through
 * the room's native SQLite transaction (D47).
 * Campaign chat and rolls execute in the room while it holds authority (D69).
 * Held Character play commands identify their active Run; rests and structural edits stay outside this lane.
 */
export const liveSessionCommandDtoSchema = lazySchema(() =>
  z.discriminatedUnion('scope', [
    z.strictObject({
      scope: z.literal('SCENE'),
      command: z.union([sceneCommandInputDtoSchema, sceneFogPublishCommandInputSchema])
    }),
    z.strictObject({
      scope: z.literal('ENCOUNTER'),
      command: z.union([
        encounterCommandInputDtoSchema,
        encounterActorTokenBindingCommandInputDtoSchema
      ])
    }),
    z.strictObject({
      scope: z.literal('CHARACTER_SHEET'),
      characterId: uuidSchema,
      encounterId: uuidSchema,
      command: characterSheetLivePlayCommandSchema
    }),
    z.strictObject({
      scope: z.literal('ENCOUNTER_BINDING'),
      command: bindEncounterToPresentedSceneInputDtoSchema
    }),
    z.strictObject({ scope: z.literal('CAMPAIGN_CHAT'), command: campaignChatLiveCommandSchema })
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
    // Local commands fan out recipient projections; transitional commits still reach only the initiator.
    z.strictObject({ scope: z.literal('ENCOUNTER'), result: encounterCommandResultDtoSchema }),
    z.strictObject({
      scope: z.literal('CHARACTER_SHEET'),
      result: characterSheetCommandResponseDtoSchema
    }),
    // Sent to every member: the Scene's Encounter binding is Campaign-visible.
    z.strictObject({
      scope: z.literal('ENCOUNTER_BINDING'),
      result: bindEncounterToPresentedSceneResultDtoSchema
    }),
    // Sent to the conversation's members: the entry as that member reads it.
    z.strictObject({ scope: z.literal('CAMPAIGN_CHAT'), entry: campaignChatEntryDtoSchema }),
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
    'RATE_LIMITED',
    'SESSION_CLOSED',
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
