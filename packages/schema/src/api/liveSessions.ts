import { z } from 'zod'
import { VTT_SCENE_LIMITS, type SceneCharacterVision } from '@artificer-toolkit/shared/vtt'
import { measurementUnitCodeSchema } from '../shared/enums.js'

import {
  characterSheetCommandInputDtoSchema,
  characterSheetCommandResponseDtoSchema
} from './characterSheetCommands.js'
import { encounterCommandInputDtoSchema, encounterCommandResultDtoSchema } from './encounters.js'
import {
  bindEncounterToPresentedSceneInputDtoSchema,
  bindEncounterToPresentedSceneResultDtoSchema,
  campaignSceneStateDtoSchema,
  encounterSceneActorTokenBindingDtoSchema,
  removeEncounterSceneActorTokenBindingInputDtoSchema,
  sceneBarrierDtoSchema,
  sceneFogLayerDtoSchema,
  scenePointDtoSchema,
  sceneCommandInputDtoSchema,
  sceneCommandResultDtoSchema,
  sceneSnapshotDtoSchema,
  sceneTokenDtoSchema,
  sceneTransientEnvelopeDtoSchema,
  setCampaignLiveScenePresentationInputDtoSchema,
  setCampaignLiveScenePresentationResultDtoSchema,
  setEncounterSceneActorTokenBindingInputDtoSchema
} from './vttScenes.js'

const uuidSchema = z.string().uuid()
const versionSchema = z.number().int().nonnegative()

export const LIVE_SESSION_PATH_PREFIX = '/live-session'
export const LIVE_SESSION_TICKET_AUDIENCE = 'artificer-live-session'
export const LIVE_SESSION_TICKET_ISSUER = 'artificer-netlify'
export const LIVE_SESSION_TICKET_PROTOCOL_PREFIX = 'artificer.ticket.'
export const LIVE_SESSION_TICKET_VERSION = 1
export const LIVE_SESSION_WEBSOCKET_PROTOCOL = 'artificer.live-session.v1'

export const liveSessionJoinOptionsDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema
})

export const liveSessionActiveMembershipDtoSchema = z.strictObject({
  role: z.enum(['OWNER', 'PLAYER']),
  userId: uuidSchema
})

export const liveSessionTicketClaimsDtoSchema = z.strictObject({
  aud: z.literal(LIVE_SESSION_TICKET_AUDIENCE),
  campaignId: uuidSchema,
  exp: z.number().int().positive(),
  iat: z.number().int().positive(),
  iss: z.literal(LIVE_SESSION_TICKET_ISSUER),
  jti: uuidSchema,
  role: z.enum(['OWNER', 'PLAYER']),
  sessionId: uuidSchema,
  sub: uuidSchema,
  v: z.literal(LIVE_SESSION_TICKET_VERSION)
})

export const liveSessionTicketDtoSchema = z.strictObject({
  expiresAt: z.string().datetime({ offset: true }),
  ticket: z.string().trim().min(1).max(4096)
})

export const liveSessionCommandDtoSchema = z.discriminatedUnion('aggregateKind', [
  z.strictObject({
    aggregateKind: z.literal('CHARACTER'),
    characterId: uuidSchema,
    command: characterSheetCommandInputDtoSchema
  }),
  z.strictObject({
    aggregateKind: z.literal('ENCOUNTER'),
    command: z.union([
      encounterCommandInputDtoSchema,
      bindEncounterToPresentedSceneInputDtoSchema,
      setEncounterSceneActorTokenBindingInputDtoSchema,
      removeEncounterSceneActorTokenBindingInputDtoSchema
    ])
  }),
  z.strictObject({
    aggregateKind: z.literal('SESSION'),
    command: setCampaignLiveScenePresentationInputDtoSchema
  }),
  z.strictObject({
    aggregateKind: z.literal('SCENE'),
    command: sceneCommandInputDtoSchema
  })
])

export const liveSessionAggregateVersionDtoSchema = z.strictObject({
  aggregateKind: z.enum(['CAMPAIGN', 'CHARACTER', 'ENCOUNTER', 'SCENE', 'SESSION']),
  aggregateId: uuidSchema,
  /** Exact command transition start when this value describes a mutation. */
  beforeVersion: versionSchema.optional(),
  version: versionSchema
})

export const liveSessionCharacterVisionDtoSchema: z.ZodType<SceneCharacterVision> = z.strictObject({
  characterId: uuidSchema,
  dimRange: z
    .strictObject({
      amount: z.number().finite().positive(),
      unit: measurementUnitCodeSchema
    })
    .nullable()
})

const liveSessionEncounterCharacterBindingDtoSchema = z.strictObject({
  actorId: uuidSchema,
  characterId: uuidSchema,
  encounterId: uuidSchema,
  tokenId: uuidSchema
})

const liveSessionEncounterSceneBindingDtoSchema = z.strictObject({
  encounterId: uuidSchema,
  sceneId: uuidSchema
})

export const liveSessionEncounterRuleOccurrenceBindingDtoSchema = z.discriminatedUnion(
  'executionKind',
  [
    z.strictObject({
      encounterId: uuidSchema,
      executionKind: z.literal('SPATIAL'),
      occurrenceId: uuidSchema,
      sceneId: uuidSchema
    }),
    z.strictObject({
      encounterId: uuidSchema,
      executionKind: z.literal('NON_SPATIAL'),
      occurrenceId: uuidSchema,
      sceneId: z.null()
    })
  ]
)

export const liveSessionEncounterRuleOccurrenceBindingUpdateDtoSchema = z
  .strictObject({
    binding: liveSessionEncounterRuleOccurrenceBindingDtoSchema.nullable(),
    encounterId: uuidSchema
  })
  .superRefine((value, context) => {
    if (value.binding && value.binding.encounterId !== value.encounterId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['binding', 'encounterId'],
        message: 'The occurrence binding update must belong to its Encounter.'
      })
    }
  })

export const liveSessionSceneVisionContextDtoSchema = z.strictObject({
  characterVisions: z.array(liveSessionCharacterVisionDtoSchema).max(10_000),
  encounterCharacterBindings: z.array(liveSessionEncounterCharacterBindingDtoSchema).max(10_000)
})

export const liveSessionTransientBroadcastDtoSchema = z.strictObject({
  envelope: sceneTransientEnvelopeDtoSchema,
  tokenDragResolution: z
    .strictObject({
      accepted: z.boolean(),
      path: z.array(scenePointDtoSchema).min(1).max(VTT_SCENE_LIMITS.transientPathPoints)
    })
    .optional(),
  visionReveal: z
    .strictObject({
      barriers: z.array(sceneBarrierDtoSchema).max(10_000),
      doorStates: z.record(uuidSchema, z.enum(['OPEN', 'CLOSED', 'LOCKED'])),
      tokens: z.array(sceneTokenDtoSchema).max(1_000)
    })
    .optional(),
  visionLayers: z.array(sceneFogLayerDtoSchema).max(101).optional(),
  userId: uuidSchema
})

export const liveSessionRejectedDtoSchema = z.strictObject({
  commandId: uuidSchema.nullable(),
  code: z.enum(['INVALID_COMMAND', 'UNAUTHORIZED', 'STALE_VERSION', 'COMMAND_FAILED']),
  message: z.string().trim().min(1).max(300)
})

export const liveSessionWebSocketClientMessageDtoSchema = z.discriminatedUnion('type', [
  z.strictObject({ command: liveSessionCommandDtoSchema, type: z.literal('COMMAND') }),
  z.strictObject({ envelope: sceneTransientEnvelopeDtoSchema, type: z.literal('TRANSIENT') }),
  z.strictObject({
    lastSeenDeliverySequence: versionSchema,
    pendingCommandIds: z.array(uuidSchema).max(100),
    type: z.literal('RESUME')
  })
])

const liveSessionCommittedMessageBaseDtoSchema = z.strictObject({
  acceptedSequence: z.number().int().positive(),
  aggregateId: uuidSchema,
  deliverySequence: z.number().int().positive(),
  originCommandId: uuidSchema,
  replayed: z.boolean(),
  changedAggregates: z.array(liveSessionAggregateVersionDtoSchema).max(10_000),
  version: versionSchema
})

export const liveSessionHostTimingDtoSchema = z.strictObject({
  category: z.enum(['SCENE_ONLY', 'RULE_BOUND', 'NON_RULE_BOUND']),
  durationMs: z.number().finite().nonnegative()
})

export const liveSessionWebSocketServerMessageDtoSchema = z.union([
  z.strictObject({
    aggregateVersions: z.array(liveSessionAggregateVersionDtoSchema).max(10_000),
    campaignId: uuidSchema,
    deliverySequence: versionSchema,
    encounterActorTokenBindings: z.array(encounterSceneActorTokenBindingDtoSchema).max(10_000),
    encounterSceneBindings: z.array(liveSessionEncounterSceneBindingDtoSchema).max(10_000),
    sceneSnapshots: z.array(sceneSnapshotDtoSchema).max(100),
    sessionId: uuidSchema,
    type: z.literal('READY')
  }),
  z.strictObject({
    acceptedSequence: z.number().int().positive(),
    commandId: uuidSchema,
    type: z.literal('COMMAND_ACCEPTED')
  }),
  liveSessionCommittedMessageBaseDtoSchema.extend({
    aggregateKind: z.literal('CHARACTER'),
    response: characterSheetCommandResponseDtoSchema.nullable(),
    sceneSnapshots: z.array(sceneSnapshotDtoSchema).max(100).optional(),
    hostTiming: liveSessionHostTimingDtoSchema.optional(),
    type: z.literal('COMMAND_COMMITTED')
  }),
  liveSessionCommittedMessageBaseDtoSchema.extend({
    aggregateKind: z.literal('ENCOUNTER'),
    encounterActorTokenBindings: z.array(encounterSceneActorTokenBindingDtoSchema).max(10_000),
    encounterSceneBindings: z.array(liveSessionEncounterSceneBindingDtoSchema).max(10_000),
    response: z
      .union([encounterCommandResultDtoSchema, bindEncounterToPresentedSceneResultDtoSchema])
      .nullable(),
    sceneSnapshots: z.array(sceneSnapshotDtoSchema).max(100).optional(),
    hostTiming: liveSessionHostTimingDtoSchema.optional(),
    type: z.literal('COMMAND_COMMITTED')
  }),
  liveSessionCommittedMessageBaseDtoSchema.extend({
    aggregateKind: z.literal('SESSION'),
    response: setCampaignLiveScenePresentationResultDtoSchema,
    sceneSnapshots: z.array(sceneSnapshotDtoSchema).max(100).optional(),
    hostTiming: liveSessionHostTimingDtoSchema.optional(),
    type: z.literal('COMMAND_COMMITTED')
  }),
  liveSessionCommittedMessageBaseDtoSchema.extend({
    aggregateKind: z.literal('SCENE'),
    delta: sceneCommandResultDtoSchema.shape.delta.nullable(),
    hostTiming: liveSessionHostTimingDtoSchema.optional(),
    snapshot: sceneSnapshotDtoSchema.nullable(),
    type: z.literal('COMMAND_COMMITTED')
  }),
  liveSessionRejectedDtoSchema.extend({ type: z.literal('COMMAND_REJECTED') }),
  z.strictObject({
    message: liveSessionTransientBroadcastDtoSchema,
    type: z.literal('TRANSIENT')
  })
])

const liveSessionExecutorRequestBaseDtoSchema = liveSessionJoinOptionsDtoSchema.extend({
  authorityId: z.string().trim().min(1).max(128),
  userId: uuidSchema
})

export const liveSessionExecutorRequestDtoSchema = z.discriminatedUnion('operation', [
  liveSessionExecutorRequestBaseDtoSchema.extend({ operation: z.literal('CLAIM') }),
  liveSessionExecutorRequestBaseDtoSchema.extend({ operation: z.literal('SNAPSHOT') }),
  liveSessionExecutorRequestBaseDtoSchema.extend({ operation: z.literal('RENEW') }),
  liveSessionExecutorRequestBaseDtoSchema.extend({ operation: z.literal('RELEASE') }),
  liveSessionExecutorRequestBaseDtoSchema.extend({
    command: liveSessionCommandDtoSchema,
    sceneVisionContext: liveSessionSceneVisionContextDtoSchema,
    operation: z.literal('COMMAND')
  })
])

export const liveSessionCoordinatorSnapshotDtoSchema = z.strictObject({
  aggregateVersions: z.array(liveSessionAggregateVersionDtoSchema).max(10_000),
  characterVisions: z.array(liveSessionCharacterVisionDtoSchema).max(10_000),
  encounterActorTokenBindings: z
    .array(encounterSceneActorTokenBindingDtoSchema)
    .max(10_000)
    .default([]),
  encounterCharacterBindings: z.array(liveSessionEncounterCharacterBindingDtoSchema).max(10_000),
  encounterSceneBindings: z
    .array(liveSessionEncounterSceneBindingDtoSchema)
    .max(10_000)
    .default([]),
  encounterRuleOccurrenceBindings: z
    .array(liveSessionEncounterRuleOccurrenceBindingDtoSchema)
    .max(10_000)
    .default([]),
  sceneStates: z.array(campaignSceneStateDtoSchema).max(100)
})

export const liveSessionEncounterBindingRefreshDtoSchema = z.strictObject({
  encounterActorTokenBindings: z.array(encounterSceneActorTokenBindingDtoSchema).max(1_000),
  encounterCharacterBindings: z.array(liveSessionEncounterCharacterBindingDtoSchema).max(1_000),
  encounterId: uuidSchema,
  encounterSceneBinding: liveSessionEncounterSceneBindingDtoSchema.nullable()
})

export const liveSessionExecutorSpatialRefreshDtoSchema = z.strictObject({
  characterVisions: z.array(liveSessionCharacterVisionDtoSchema).max(10_000),
  sceneState: campaignSceneStateDtoSchema
})

export const liveSessionExecutorCommandResultDtoSchema = z.discriminatedUnion('aggregateKind', [
  z.strictObject({
    aggregateId: uuidSchema,
    aggregateKind: z.literal('CHARACTER'),
    changedAggregates: z.array(liveSessionAggregateVersionDtoSchema).max(10_000),
    commandId: uuidSchema,
    characterVision: liveSessionCharacterVisionDtoSchema,
    replayed: z.boolean(),
    hostTiming: liveSessionHostTimingDtoSchema,
    response: characterSheetCommandResponseDtoSchema.nullable(),
    spatialRefresh: liveSessionExecutorSpatialRefreshDtoSchema.optional(),
    version: versionSchema
  }),
  z.strictObject({
    aggregateId: uuidSchema,
    aggregateKind: z.literal('ENCOUNTER'),
    changedAggregates: z.array(liveSessionAggregateVersionDtoSchema).max(10_000),
    bindingRefresh: liveSessionEncounterBindingRefreshDtoSchema.optional(),
    commandId: uuidSchema,
    hostTiming: liveSessionHostTimingDtoSchema,
    occurrenceBindingUpdate: liveSessionEncounterRuleOccurrenceBindingUpdateDtoSchema.optional(),
    replayed: z.boolean(),
    response: z.union([
      encounterCommandResultDtoSchema,
      bindEncounterToPresentedSceneResultDtoSchema
    ]),
    spatialRefresh: liveSessionExecutorSpatialRefreshDtoSchema.optional(),
    version: versionSchema
  }),
  z.strictObject({
    aggregateId: uuidSchema,
    aggregateKind: z.literal('SESSION'),
    changedAggregates: z.array(liveSessionAggregateVersionDtoSchema).max(10_000),
    commandId: uuidSchema,
    hostTiming: liveSessionHostTimingDtoSchema,
    replayed: z.boolean(),
    response: setCampaignLiveScenePresentationResultDtoSchema,
    sceneState: campaignSceneStateDtoSchema.nullable(),
    version: versionSchema
  }),
  z.strictObject({
    aggregateId: uuidSchema,
    aggregateKind: z.literal('SCENE'),
    changedAggregates: z.array(liveSessionAggregateVersionDtoSchema).max(10_000),
    commandId: uuidSchema,
    hostTiming: liveSessionHostTimingDtoSchema,
    occurrenceBindingUpdate: liveSessionEncounterRuleOccurrenceBindingUpdateDtoSchema.optional(),
    replayed: z.boolean(),
    response: sceneCommandResultDtoSchema.nullable(),
    spatialRefresh: liveSessionExecutorSpatialRefreshDtoSchema.optional(),
    state: campaignSceneStateDtoSchema,
    version: versionSchema
  })
])

export const liveSessionExecutorResponseDtoSchema = z.discriminatedUnion('operation', [
  z.strictObject({ ok: z.literal(true), operation: z.literal('CLAIM') }),
  z.strictObject({
    operation: z.literal('SNAPSHOT'),
    snapshot: liveSessionCoordinatorSnapshotDtoSchema
  }),
  z.strictObject({
    aggregateVersions: z.array(liveSessionAggregateVersionDtoSchema).max(10_000),
    memberships: z.array(liveSessionActiveMembershipDtoSchema).max(10_000),
    ok: z.literal(true),
    operation: z.literal('RENEW')
  }),
  z.strictObject({ ok: z.literal(true), operation: z.literal('RELEASE') }),
  z.strictObject({
    execution: liveSessionExecutorCommandResultDtoSchema,
    operation: z.literal('COMMAND')
  })
])

export const liveSessionExecutorErrorDtoSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(['INVALID_REQUEST', 'UNAUTHORIZED', 'CONFLICT', 'COMMAND_FAILED']),
    message: z.string().trim().min(1).max(300)
  })
})

export type LiveSessionJoinOptionsDto = z.infer<typeof liveSessionJoinOptionsDtoSchema>
export type LiveSessionActiveMembershipDto = z.infer<typeof liveSessionActiveMembershipDtoSchema>
export type LiveSessionTicketClaimsDto = z.infer<typeof liveSessionTicketClaimsDtoSchema>
export type LiveSessionTicketDto = z.infer<typeof liveSessionTicketDtoSchema>
export type LiveSessionCommandDto = z.infer<typeof liveSessionCommandDtoSchema>
export type LiveSessionAggregateVersionDto = z.infer<typeof liveSessionAggregateVersionDtoSchema>
export type LiveSessionRejectedDto = z.infer<typeof liveSessionRejectedDtoSchema>
export type LiveSessionHostTimingDto = z.infer<typeof liveSessionHostTimingDtoSchema>
export type LiveSessionTransientBroadcastDto = z.infer<
  typeof liveSessionTransientBroadcastDtoSchema
>
export type LiveSessionWebSocketClientMessageDto = z.infer<
  typeof liveSessionWebSocketClientMessageDtoSchema
>
export type LiveSessionWebSocketServerMessageDto = z.infer<
  typeof liveSessionWebSocketServerMessageDtoSchema
>
export type LiveSessionExecutorRequestDto = z.infer<typeof liveSessionExecutorRequestDtoSchema>
export type LiveSessionSceneVisionContextDto = z.infer<
  typeof liveSessionSceneVisionContextDtoSchema
>
export type LiveSessionCoordinatorSnapshotDto = z.infer<
  typeof liveSessionCoordinatorSnapshotDtoSchema
>
export type LiveSessionEncounterRuleOccurrenceBindingDto = z.infer<
  typeof liveSessionEncounterRuleOccurrenceBindingDtoSchema
>
export type LiveSessionEncounterRuleOccurrenceBindingUpdateDto = z.infer<
  typeof liveSessionEncounterRuleOccurrenceBindingUpdateDtoSchema
>
export type LiveSessionExecutorSpatialRefreshDto = z.infer<
  typeof liveSessionExecutorSpatialRefreshDtoSchema
>
export type LiveSessionExecutorCommandResultDto = z.infer<
  typeof liveSessionExecutorCommandResultDtoSchema
>
export type LiveSessionExecutorResponseDto = z.infer<typeof liveSessionExecutorResponseDtoSchema>
export type LiveSessionExecutorErrorDto = z.infer<typeof liveSessionExecutorErrorDtoSchema>
