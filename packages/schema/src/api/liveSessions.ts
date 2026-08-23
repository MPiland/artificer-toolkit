import { z } from 'zod'
import { VTT_SCENE_LIMITS, type SceneCharacterVision } from '@artificer-toolkit/shared/vtt'
import { measurementUnitCodeSchema } from '../shared/enums.js'

import {
  characterSheetCommandInputDtoSchema,
  characterSheetCommandResponseDtoSchema
} from './characterSheetCommands.js'
import { encounterCommandInputDtoSchema, encounterCommandResultDtoSchema } from './encounters.js'
import {
  attachEncounterSceneInputDtoSchema,
  encounterSceneStateDtoSchema,
  sceneBarrierDtoSchema,
  sceneFogLayerDtoSchema,
  scenePointDtoSchema,
  sceneCommandInputDtoSchema,
  sceneCommandResultDtoSchema,
  sceneSnapshotDtoSchema,
  sceneTokenDtoSchema,
  sceneTransientEnvelopeDtoSchema
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
    command: encounterCommandInputDtoSchema
  }),
  z.strictObject({
    aggregateKind: z.literal('SCENE'),
    command: z.union([attachEncounterSceneInputDtoSchema, sceneCommandInputDtoSchema])
  })
])

export const liveSessionAggregateVersionDtoSchema = z.strictObject({
  aggregateKind: z.enum(['CAMPAIGN', 'CHARACTER', 'ENCOUNTER', 'SCENE']),
  aggregateId: uuidSchema,
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
  encounterId: uuidSchema
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
    response: encounterCommandResultDtoSchema.nullable(),
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
  encounterCharacterBindings: z.array(liveSessionEncounterCharacterBindingDtoSchema).max(10_000),
  sceneStates: z.array(encounterSceneStateDtoSchema).max(100)
})

export const liveSessionExecutorCommandResultDtoSchema = z.discriminatedUnion('aggregateKind', [
  z.strictObject({
    aggregateId: uuidSchema,
    aggregateKind: z.literal('CHARACTER'),
    commandId: uuidSchema,
    characterVision: liveSessionCharacterVisionDtoSchema,
    replayed: z.boolean(),
    hostTiming: liveSessionHostTimingDtoSchema,
    response: characterSheetCommandResponseDtoSchema.nullable(),
    version: versionSchema
  }),
  z.strictObject({
    aggregateId: uuidSchema,
    aggregateKind: z.literal('ENCOUNTER'),
    commandId: uuidSchema,
    hostTiming: liveSessionHostTimingDtoSchema,
    replayed: z.boolean(),
    response: encounterCommandResultDtoSchema,
    version: versionSchema
  }),
  z.strictObject({
    aggregateId: uuidSchema,
    aggregateKind: z.literal('SCENE'),
    commandId: uuidSchema,
    hostTiming: liveSessionHostTimingDtoSchema,
    replayed: z.boolean(),
    response: sceneCommandResultDtoSchema.nullable(),
    state: encounterSceneStateDtoSchema,
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
export type LiveSessionExecutorCommandResultDto = z.infer<
  typeof liveSessionExecutorCommandResultDtoSchema
>
export type LiveSessionExecutorResponseDto = z.infer<typeof liveSessionExecutorResponseDtoSchema>
export type LiveSessionExecutorErrorDto = z.infer<typeof liveSessionExecutorErrorDtoSchema>
