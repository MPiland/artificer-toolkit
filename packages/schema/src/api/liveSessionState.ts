import { z } from '../zod.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { liveSessionSequenceDtoSchema } from './liveSessionCommands.js'
import { sceneGeometrySessionInputSchema } from './sceneGeometry.js'
import {
  sceneCommandResultDtoSchema,
  sceneDoorStateCommandInputDtoSchema,
  sceneTokenMovementCommandInputDtoSchema,
  sceneUndoLastMoveCommandInputDtoSchema
} from './vttScenes.js'

export const liveSessionScenePublicationDtoSchema = z.strictObject({
  scope: z.literal('SCENE'),
  command: z.union([
    sceneDoorStateCommandInputDtoSchema,
    sceneTokenMovementCommandInputDtoSchema,
    sceneUndoLastMoveCommandInputDtoSchema
  ]),
  session: sceneGeometrySessionInputSchema
})

export const liveSessionBootstrapInputSchema = z.strictObject({
  campaignId: postgresUuidSchema,
  sessionId: postgresUuidSchema,
  authorityEpoch: postgresUuidSchema,
  expectedUserId: postgresUuidSchema,
  expectedRole: z.enum(['OWNER', 'PLAYER'])
})

export const liveSessionBootstrapResponseSchema = z.strictObject({
  activationFingerprint: projectionChecksumSchema,
  persistedSequence: liveSessionSequenceDtoSchema,
  persistedStateChecksum: projectionChecksumSchema
})

export const liveSessionActivationInputSchema = z.strictObject({
  campaignId: postgresUuidSchema,
  sessionId: postgresUuidSchema,
  epoch: postgresUuidSchema,
  activationFingerprint: projectionChecksumSchema,
  stateChecksum: projectionChecksumSchema
})

export const liveSessionDrainReleaseInputSchema = z.strictObject({
  campaignId: postgresUuidSchema,
  sessionId: postgresUuidSchema,
  epoch: postgresUuidSchema,
  finalSequence: liveSessionSequenceDtoSchema,
  finalStateChecksum: projectionChecksumSchema
})

export const liveSessionAuthorityDtoSchema = z.strictObject({
  campaignId: postgresUuidSchema,
  sessionId: postgresUuidSchema,
  epoch: postgresUuidSchema,
  phase: z.enum(['ACTIVATING', 'DO_ACTIVE', 'DRAINING']),
  activationFingerprint: projectionChecksumSchema,
  activationExpiresAt: z.optional(z.number().check(z.int()).check(z.positive())),
  persistedSequence: liveSessionSequenceDtoSchema,
  persistedStateChecksum: projectionChecksumSchema,
  finalSequence: z.optional(liveSessionSequenceDtoSchema),
  finalStateChecksum: z.optional(projectionChecksumSchema),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true })
})

const liveSessionPublishBase = {
  campaignId: postgresUuidSchema,
  sessionId: postgresUuidSchema,
  epoch: postgresUuidSchema,
  sequence: liveSessionSequenceDtoSchema,
  expectedStateChecksum: projectionChecksumSchema,
  stateChecksum: projectionChecksumSchema,
  actorUserId: postgresUuidSchema,
  actorRole: z.enum(['OWNER', 'PLAYER']),
  occurredAt: z.iso.datetime({ offset: true }),
  receiptId: postgresUuidSchema
}

export const liveSessionPublishInputSchema = z.strictObject({
  ...liveSessionPublishBase,
  command: liveSessionScenePublicationDtoSchema,
  expectedSceneResult: sceneCommandResultDtoSchema
})

export const liveSessionPublishResponseSchema = z.strictObject({
  scope: z.literal('SCENE'),
  authority: liveSessionAuthorityDtoSchema,
  sceneResult: sceneCommandResultDtoSchema
})

export type LiveSessionScenePublicationDto = z.infer<typeof liveSessionScenePublicationDtoSchema>
export type LiveSessionBootstrapInput = z.infer<typeof liveSessionBootstrapInputSchema>
export type LiveSessionBootstrapResponse = z.infer<typeof liveSessionBootstrapResponseSchema>
export type LiveSessionActivationInput = z.infer<typeof liveSessionActivationInputSchema>
export type LiveSessionDrainReleaseInput = z.infer<typeof liveSessionDrainReleaseInputSchema>
export type LiveSessionAuthorityDto = z.infer<typeof liveSessionAuthorityDtoSchema>
export type LiveSessionPublishInput = z.infer<typeof liveSessionPublishInputSchema>
export type LiveSessionPublishResponse = z.infer<typeof liveSessionPublishResponseSchema>
