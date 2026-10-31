import { z, lazySchema } from '../zod.js'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'
import {
  domainRejectionReasonDtoSchema,
  maintainedReplacementChoicesDtoSchema
} from './domainRejections.js'
import { encounterRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'
import { encounterReadDtoSchema, encounterReadResultDtoSchema } from './encounterRead.js'
import {
  characterSheetOverviewDtoSchema,
  characterSheetResponseDtoSchema
} from './characterSheetData.js'
import {
  sceneBarrierDtoSchema,
  sceneFogLayerDtoSchema,
  scenePointDtoSchema,
  sceneTokenDtoSchema,
  sceneTransientEnvelopeDtoSchema,
  setCampaignLiveScenePresentationInputDtoSchema
} from './vttScenes.js'
import {
  sceneFogAppendInputSchema,
  sceneFogPatchInputSchema,
  sceneFogSaveProgressSchema
} from './sceneFog.js'
import {
  liveSessionCommandDtoSchema,
  liveSessionCommandRejectionCodeDtoSchema,
  liveSessionCorrectionDtoSchema,
  liveSessionRecipientDeltaDtoSchema,
  liveSessionRecipientStateDtoSchema,
  liveSessionSequenceDtoSchema
} from './liveSessionCommands.js'
import {
  encounterActorSidesDtoSchema,
  encounterPlayerProjectionDtoSchema,
  encounterPreparedPendingListDtoSchema,
  encounterSessionStateDtoSchema,
  encounterSettledDecisionDtoSchema,
  encounterTimelineDtoSchema
} from './encounterData.js'

export {
  liveSessionCommandDtoSchema,
  liveSessionCommandRejectionCodeDtoSchema,
  liveSessionCorrectionDtoSchema,
  liveSessionRecipientDeltaDtoSchema,
  liveSessionRecipientStateDtoSchema,
  liveSessionSequenceDtoSchema,
  type LiveSessionCommandDto,
  type LiveSessionCommandRejectionCodeDto,
  type LiveSessionCorrectionDto,
  type LiveSessionRecipientDeltaDto,
  type LiveSessionRecipientStateDto
} from './liveSessionCommands.js'

export {
  LIVE_SESSION_PATH_PREFIX,
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  LIVE_SESSION_TICKET_PROTOCOL_PREFIX,
  LIVE_SESSION_TICKET_VERSION,
  LIVE_SESSION_WEBSOCKET_PROTOCOL,
  liveSessionJoinOptionsDtoSchema,
  liveSessionActiveMembershipDtoSchema,
  liveSessionTicketClaimsDtoSchema,
  liveSessionTicketAdmissionDtoSchema,
  liveSessionTicketDtoSchema,
  type LiveSessionJoinOptionsDto,
  type LiveSessionActiveMembershipDto,
  type LiveSessionTicketClaimsDto,
  type LiveSessionTicketAdmissionDto,
  type LiveSessionTicketDto
} from './liveSessionIdentity.js'

const uuidSchema = lazySchema(() => z.string().check(z.uuid()))
const versionSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))

/**
 * The room's Encounter session for one member: held while the room holds the Campaign's ACTIVE Run
 * (or PREPARED Runs paused on a START decision); otherwise the Convex reads are current. `version`
 * is the ACTIVE Run's, else the highest held PREPARED Run's. `actorSides` is the GM's alone, and
 * `timeline` is the ACTIVE Run's, present only when the subscriber asked for it.
 */
export const encounterSessionFrameDtoSchema = lazySchema(() =>
  z.discriminatedUnion('held', [
    z.strictObject({ held: z.literal(false) }),
    z.strictObject({
      held: z.literal(true),
      version: versionSchema,
      state: encounterSessionStateDtoSchema,
      preparedPending: encounterPreparedPendingListDtoSchema,
      actorSides: z.nullable(encounterActorSidesDtoSchema),
      settlement: z.nullable(encounterSettledDecisionDtoSchema),
      timeline: z.nullable(encounterTimelineDtoSchema)
    })
  ])
)
export type EncounterSessionFrameDto = z.infer<typeof encounterSessionFrameDtoSchema>

const MAX_SUMMARY_CHARACTERS = 1_000

/**
 * The live Campaign summary for one member (ADR 0035 Amendment 19): the Character fields the
 * Party roster and GM Session read from the COMMON Sheet slice, and the ACTIVE Run's status, round
 * and current actor, each as that member may read them. Only Characters and the Run the room holds
 * appear; the page keeps Convex's value for everything else. `currentActorId` is the player
 * projection's, so it is null while the current actor is hidden from a player.
 */
export const liveCampaignSummaryDtoSchema = lazySchema(() =>
  z.strictObject({
    characters: z
      .array(
        z.extend(
          z.pick(characterSheetOverviewDtoSchema, {
            currentHitPoints: true,
            maxHitPoints: true,
            tempHitPoints: true,
            conditions: true
          }),
          { characterId: uuidSchema }
        )
      )
      .check(z.maxLength(MAX_SUMMARY_CHARACTERS)),
    encounter: z.nullable(
      z.extend(
        z.pick(encounterPlayerProjectionDtoSchema, {
          round: true,
          currentActorId: true
        }),
        { encounterId: uuidSchema, status: z.literal('ACTIVE') }
      )
    )
  })
)
export type LiveCampaignSummaryDto = z.infer<typeof liveCampaignSummaryDtoSchema>

export const LIVE_SESSION_CONTROL_PATH = '/internal/live-sessions/control'
export const LIVE_SESSION_CONTROL_SECRET_HEADER = 'x-artificer-live-session-secret'
/** Development-only Worker routes (`<path>/<campaignId>`) the V15 load proof calls with the Worker secret. */
export const LIVE_SESSION_METER_PATH = '/internal/live-sessions/meter'
export const LIVE_SESSION_CHECKPOINT_BARRIER_PATH = '/internal/live-sessions/checkpoint'
/** Local-development-only Worker route (`<path>/<campaignId>`) a test uses to set the room's next dice. */
export const LIVE_SESSION_TEST_ROLLS_PATH = '/internal/live-sessions/test-rolls'

const testRollSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))

/**
 * Replaces a room's test dice: each roll takes the next of `rolls` (an empty list ends the queue),
 * then `repeat` if given, else the platform CSPRNG. A value is returned as it is, whatever the die.
 */
export const liveSessionTestRollsInputSchema = lazySchema(() =>
  z.strictObject({
    rolls: z.array(testRollSchema).check(z.maxLength(1_000)),
    repeat: z.optional(testRollSchema)
  })
)
export type LiveSessionTestRollsInputDto = z.infer<typeof liveSessionTestRollsInputSchema>

const scenePresentationOperationSchema = lazySchema(() =>
  z.strictObject({
    type: z.literal('SET_SCENE_PRESENTATION'),
    actorUserId: uuidSchema,
    epoch: uuidSchema,
    input: setCampaignLiveScenePresentationInputDtoSchema
  })
)

export const liveSessionPresentationControlInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    operation: scenePresentationOperationSchema
  })
)

export const liveSessionPresentationCommitInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    actorUserId: uuidSchema,
    epoch: uuidSchema,
    input: setCampaignLiveScenePresentationInputDtoSchema,
    expectedSequence: liveSessionSequenceDtoSchema,
    expectedStateChecksum: z.nullable(z.string().check(z.regex(/^[a-f0-9]{64}$/)))
  })
)

/**
 * What changed in one Convex transaction for the room's cached inputs (ADR 0035 Amendment 14):
 * CAMPAIGN (memberships, assignments, content shares, the Campaign), PLAY (`campaignPlaySettings`),
 * CHARACTER (an assigned Character) and PREFERENCES (a member's auto-roll preference).
 */
export const liveSessionInputScopeSchema = lazySchema(() =>
  z.enum(['CAMPAIGN', 'PLAY', 'CHARACTER', 'PREFERENCES'])
)

export const liveSessionControlInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    operation: z.discriminatedUnion('type', [
      z.strictObject({
        type: z.literal('EVICT_USER'),
        userId: uuidSchema,
        membershipEpoch: z.iso.datetime({ offset: true })
      }),
      z.strictObject({ type: z.literal('CLOSE_ROOM') }),
      z.strictObject({ type: z.literal('DELETE_ROOM') }),
      z.strictObject({
        type: z.literal('INVALIDATE_INPUTS'),
        scopes: z
          .array(liveSessionInputScopeSchema)
          .check(z.minLength(1))
          .check(z.maxLength(4))
          .check(z.refine((scopes) => new Set(scopes).size === scopes.length))
      }),
      scenePresentationOperationSchema
    ])
  })
)

export const liveSessionTransientBroadcastDtoSchema = lazySchema(() =>
  z.strictObject({
    envelope: sceneTransientEnvelopeDtoSchema,
    tokenDragResolution: z.optional(
      z.strictObject({
        accepted: z.boolean(),
        path: z
          .array(scenePointDtoSchema)
          .check(z.minLength(1))
          .check(z.maxLength(VTT_SCENE_LIMITS.transientPathPoints))
      })
    ),
    visionReveal: z.optional(
      z.strictObject({
        barriers: z.array(sceneBarrierDtoSchema).check(z.maxLength(10_000)),
        doorStates: z.record(uuidSchema, z.enum(['OPEN', 'CLOSED', 'LOCKED'])),
        tokens: z.array(sceneTokenDtoSchema).check(z.maxLength(1_000))
      })
    ),
    visionLayers: z.optional(z.array(sceneFogLayerDtoSchema).check(z.maxLength(101))),
    userId: uuidSchema
  })
)

export const liveSessionWebSocketClientMessageDtoSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
    z.strictObject({
      accessToken: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(16_384)),
      type: z.literal('AUTHENTICATE')
    }),
    z.strictObject({ envelope: sceneTransientEnvelopeDtoSchema, type: z.literal('TRANSIENT') }),
    z.strictObject({
      command: liveSessionCommandDtoSchema,
      expectedSessionSequence: liveSessionSequenceDtoSchema,
      type: z.literal('COMMAND')
    }),
    z.strictObject({
      lastAppliedSequence: liveSessionSequenceDtoSchema,
      type: z.literal('RESUME')
    }),
    // One Character Sheet per socket; a new subscription replaces the previous one.
    z.strictObject({
      characterId: uuidSchema,
      type: z.literal('SUBSCRIBE_CHARACTER_SHEET')
    }),
    z.strictObject({ type: z.literal('UNSUBSCRIBE_CHARACTER_SHEET') }),
    // One Encounter session subscription per socket; a new one replaces the previous.
    z.strictObject({ timeline: z.boolean(), type: z.literal('SUBSCRIBE_ENCOUNTER_SESSION') }),
    z.strictObject({ type: z.literal('UNSUBSCRIBE_ENCOUNTER_SESSION') }),
    // One live Campaign summary subscription per socket, independent of the other two.
    z.strictObject({ type: z.literal('SUBSCRIBE_CAMPAIGN_SUMMARY') }),
    z.strictObject({ type: z.literal('UNSUBSCRIBE_CAMPAIGN_SUMMARY') }),
    // One version-keyed turn read answered from the room's own Encounter state, on demand. It
    // answers with ENCOUNTER_READ_RESULT or ENCOUNTER_READ_REJECTED for the same request ID.
    z.strictObject({
      read: encounterReadDtoSchema,
      requestId: uuidSchema,
      type: z.literal('ENCOUNTER_READ')
    }),
    // The GM's fog patch stages in bounded batches under the socket cap; each answers with
    // SCENE_FOG_PROGRESS or COMMAND_REJECTED for the patch's command ID (D79).
    z.strictObject({ input: sceneFogPatchInputSchema, type: z.literal('SCENE_FOG_BEGIN') }),
    z.strictObject({
      commandId: uuidSchema,
      input: sceneFogAppendInputSchema,
      type: z.literal('SCENE_FOG_APPEND')
    })
  ])
)

export const liveSessionWebSocketServerMessageDtoSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('AUTHENTICATION_REQUIRED') }),
    z.strictObject({
      campaignId: uuidSchema,
      type: z.literal('TRANSIENT_READY')
    }),
    z.strictObject({
      message: liveSessionTransientBroadcastDtoSchema,
      type: z.literal('TRANSIENT')
    }),
    z.strictObject({
      authorityEpoch: uuidSchema,
      sequence: liveSessionSequenceDtoSchema,
      state: liveSessionRecipientStateDtoSchema,
      type: z.literal('STATE_SYNC')
    }),
    // Unsequenced: the viewer-projected held Sheet at its current play stream version (D73).
    z.strictObject({
      characterId: uuidSchema,
      sheet: characterSheetResponseDtoSchema,
      streamVersion: versionSchema,
      type: z.literal('CHARACTER_SHEET')
    }),
    // Unsequenced: the subscriber's Encounter session as the room holds it.
    z.strictObject({
      session: encounterSessionFrameDtoSchema,
      type: z.literal('ENCOUNTER_SESSION')
    }),
    // Unsequenced: the subscriber's live Campaign summary, sent when it changes.
    z.strictObject({
      summary: liveCampaignSummaryDtoSchema,
      type: z.literal('CAMPAIGN_SUMMARY')
    }),
    // Unsequenced: the answer to one ENCOUNTER_READ at the Encounter session version it was read at.
    z.strictObject({
      requestId: uuidSchema,
      result: encounterReadResultDtoSchema,
      type: z.literal('ENCOUNTER_READ_RESULT'),
      version: versionSchema
    }),
    // Unsequenced: an ENCOUNTER_READ the room refused; `UNAVAILABLE` means it cannot answer from
    // its own state, so the client reads from Convex instead.
    z.strictObject({
      code: liveSessionCommandRejectionCodeDtoSchema,
      message: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000)),
      reason: z.nullable(domainRejectionReasonDtoSchema),
      requestId: uuidSchema,
      type: z.literal('ENCOUNTER_READ_REJECTED')
    }),
    z.strictObject({
      commandId: uuidSchema,
      delta: z.nullable(liveSessionRecipientDeltaDtoSchema),
      sequence: liveSessionSequenceDtoSchema,
      type: z.literal('COMMAND_COMMITTED')
    }),
    z.strictObject({
      code: liveSessionCommandRejectionCodeDtoSchema,
      commandId: uuidSchema,
      correction: z.optional(liveSessionCorrectionDtoSchema),
      currentSequence: liveSessionSequenceDtoSchema,
      message: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000)),
      // The expected domain reason for `DOMAIN_REJECTED`; `null` for every other code.
      reason: z.nullable(domainRejectionReasonDtoSchema),
      // The unacknowledged warnings for reason `RULE_WARNINGS`; `null` otherwise.
      warnings: z.nullable(encounterRuleWarningsDtoSchema),
      // The held effects the caster chooses between for reason `MAINTAINED_REPLACEMENT_REQUIRED`.
      heldStates: z.optional(maintainedReplacementChoicesDtoSchema),
      type: z.literal('COMMAND_REJECTED')
    }),
    // Unsequenced: only the uploading socket learns its staged fog patch's progress.
    z.strictObject({ progress: sceneFogSaveProgressSchema, type: z.literal('SCENE_FOG_PROGRESS') })
  ])
)

export type LiveSessionTransientBroadcastDto = z.infer<
  typeof liveSessionTransientBroadcastDtoSchema
>
export type LiveSessionInputScope = z.infer<typeof liveSessionInputScopeSchema>
export type LiveSessionControlInput = z.infer<typeof liveSessionControlInputSchema>
export type LiveSessionPresentationControlInput = z.infer<
  typeof liveSessionPresentationControlInputSchema
>
export type LiveSessionPresentationCommitInput = z.infer<
  typeof liveSessionPresentationCommitInputSchema
>
export type LiveSessionWebSocketClientMessageDto = z.infer<
  typeof liveSessionWebSocketClientMessageDtoSchema
>
export type LiveSessionWebSocketServerMessageDto = z.infer<
  typeof liveSessionWebSocketServerMessageDtoSchema
>
