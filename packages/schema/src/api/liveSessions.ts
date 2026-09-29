import { z, lazySchema } from '../zod.js'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'
import { domainRejectionReasonDtoSchema } from './domainRejections.js'
import { encounterRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'
import {
  sceneBarrierDtoSchema,
  sceneFogLayerDtoSchema,
  scenePointDtoSchema,
  sceneTokenDtoSchema,
  sceneTransientEnvelopeDtoSchema,
  setCampaignLiveScenePresentationInputDtoSchema
} from './vttScenes.js'
import {
  liveSessionCommandDtoSchema,
  liveSessionCommandRejectionCodeDtoSchema,
  liveSessionCorrectionDtoSchema,
  liveSessionRecipientDeltaDtoSchema,
  liveSessionRecipientStateDtoSchema,
  liveSessionSequenceDtoSchema
} from './liveSessionCommands.js'

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

export const LIVE_SESSION_CONTROL_PATH = '/internal/live-sessions/control'
export const LIVE_SESSION_CONTROL_SECRET_HEADER = 'x-artificer-live-session-secret'

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
    z.strictObject({
      expectedPresentationVersion: versionSchema,
      sceneId: uuidSchema,
      type: z.literal('SYNCHRONIZE_SCENE'),
      version: versionSchema
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
      type: z.literal('COMMAND_REJECTED')
    })
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
