import { z } from 'zod'

import {
  characterSheetCommandInputDtoSchema,
  characterSheetCommandResponseDtoSchema
} from './characterSheetCommands.js'
import { encounterCommandInputDtoSchema, encounterCommandResultDtoSchema } from './encounters.js'

const uuidSchema = z.string().uuid()
const versionSchema = z.number().int().nonnegative()

export const LIVE_SESSION_ROOM_NAME = 'live-session'
export const LIVE_SESSION_COMMAND_MESSAGE = 'command'
export const LIVE_SESSION_COMMITTED_MESSAGE = 'committed'
export const LIVE_SESSION_RESULT_MESSAGE = 'result'
export const LIVE_SESSION_REJECTED_MESSAGE = 'rejected'
export const LIVE_SESSION_READY_MESSAGE = 'ready'

export const liveSessionJoinOptionsDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema
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
  })
])

export const liveSessionAggregateVersionDtoSchema = z.strictObject({
  aggregateKind: z.enum(['CHARACTER', 'ENCOUNTER']),
  aggregateId: uuidSchema,
  version: versionSchema
})

export const liveSessionReadyDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  roomVersion: versionSchema,
  aggregateVersions: z.array(liveSessionAggregateVersionDtoSchema)
})

export const liveSessionCommittedDtoSchema = liveSessionAggregateVersionDtoSchema.extend({
  commandId: uuidSchema,
  roomVersion: versionSchema
})

export const liveSessionResultDtoSchema = z.discriminatedUnion('aggregateKind', [
  z.strictObject({
    aggregateKind: z.literal('CHARACTER'),
    commandId: uuidSchema,
    roomVersion: versionSchema,
    replayed: z.boolean(),
    response: characterSheetCommandResponseDtoSchema
  }),
  z.strictObject({
    aggregateKind: z.literal('ENCOUNTER'),
    commandId: uuidSchema,
    roomVersion: versionSchema,
    replayed: z.boolean(),
    response: encounterCommandResultDtoSchema
  })
])

export const liveSessionRejectedDtoSchema = z.strictObject({
  commandId: uuidSchema.nullable(),
  code: z.enum(['INVALID_COMMAND', 'UNAUTHORIZED', 'STALE_VERSION', 'COMMAND_FAILED']),
  message: z.string().trim().min(1).max(300)
})

export type LiveSessionJoinOptionsDto = z.infer<typeof liveSessionJoinOptionsDtoSchema>
export type LiveSessionCommandDto = z.infer<typeof liveSessionCommandDtoSchema>
export type LiveSessionAggregateVersionDto = z.infer<typeof liveSessionAggregateVersionDtoSchema>
export type LiveSessionReadyDto = z.infer<typeof liveSessionReadyDtoSchema>
export type LiveSessionCommittedDto = z.infer<typeof liveSessionCommittedDtoSchema>
export type LiveSessionResultDto = z.infer<typeof liveSessionResultDtoSchema>
export type LiveSessionRejectedDto = z.infer<typeof liveSessionRejectedDtoSchema>
