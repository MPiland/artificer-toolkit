import { z, lazySchema, lazySchemaParts } from '../zod.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { liveSessionSequenceDtoSchema } from './liveSessionCommands.js'
import { liveSessionStoredCheckpointFenceSchema } from './liveSessionCheckpointFence.js'
import { scenePresentationFenceSchema } from './sceneGeometry.js'
import {
  sceneCommandResultDtoSchema,
  sceneDoorStateCommandInputDtoSchema,
  sceneTokenMovementCommandInputDtoSchema,
  sceneUndoLastMoveCommandInputDtoSchema
} from './vttScenes.js'

export const liveSessionScenePublicationDtoSchema = lazySchema(() =>
  z.strictObject({
    scope: z.literal('SCENE'),
    command: z.union([
      sceneDoorStateCommandInputDtoSchema,
      sceneTokenMovementCommandInputDtoSchema,
      sceneUndoLastMoveCommandInputDtoSchema
    ]),
    presentation: scenePresentationFenceSchema
  })
)

export const liveSessionBootstrapInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: postgresUuidSchema,
    authorityEpoch: postgresUuidSchema,
    expectedUserId: postgresUuidSchema,
    expectedRole: z.enum(['OWNER', 'PLAYER'])
  })
)

export const liveSessionBootstrapResponseSchema = lazySchema(() =>
  z.strictObject({
    activationFingerprint: projectionChecksumSchema,
    persistedSequence: liveSessionSequenceDtoSchema,
    persistedStateChecksum: projectionChecksumSchema
  })
)

export const liveSessionActivationInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: postgresUuidSchema,
    epoch: postgresUuidSchema,
    activationFingerprint: projectionChecksumSchema,
    stateChecksum: projectionChecksumSchema
  })
)

/** Worker-secret recovery fences corrupt/lost room storage; it never publishes the abandoned state. */
export const liveSessionStorageRecoveryInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: postgresUuidSchema,
    epoch: postgresUuidSchema
  })
)

export const liveSessionDrainReleaseInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: postgresUuidSchema,
    epoch: postgresUuidSchema,
    finalSequence: liveSessionSequenceDtoSchema,
    finalStateChecksum: projectionChecksumSchema
  })
)

/**
 * Present while the Campaign's live room holds authority: chat and rolls go to the room, and pages
 * outside it read the last checkpoint. `checkpointedAt` is null until the epoch's first acknowledged
 * checkpoint.
 */
export const campaignLiveAuthorityDtoSchema = lazySchema(() =>
  z.strictObject({
    campaignId: postgresUuidSchema,
    epoch: postgresUuidSchema,
    checkpointedAt: z.nullable(z.iso.datetime({ offset: true }))
  })
)

export type CampaignLiveAuthorityDto = z.infer<typeof campaignLiveAuthorityDtoSchema>

export const liveSessionAuthorityDtoSchema = lazySchema(() =>
  z.strictObject({
    campaignId: postgresUuidSchema,
    epoch: postgresUuidSchema,
    phase: z.enum(['ACTIVATING', 'DO_ACTIVE', 'DRAINING']),
    activationFingerprint: projectionChecksumSchema,
    activationExpiresAt: z.optional(z.number().check(z.int()).check(z.positive())),
    persistedSequence: liveSessionSequenceDtoSchema,
    persistedStateChecksum: projectionChecksumSchema,
    lastCheckpoint: z.optional(liveSessionStoredCheckpointFenceSchema),
    checkpointedAt: z.optional(z.iso.datetime({ offset: true })),
    finalSequence: z.optional(liveSessionSequenceDtoSchema),
    finalStateChecksum: z.optional(projectionChecksumSchema),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true })
  })
)

const liveSessionPublishBase = lazySchemaParts(() => ({
  campaignId: postgresUuidSchema,
  epoch: postgresUuidSchema,
  sequence: liveSessionSequenceDtoSchema,
  expectedStateChecksum: projectionChecksumSchema,
  stateChecksum: projectionChecksumSchema,
  actorUserId: postgresUuidSchema,
  actorRole: z.enum(['OWNER', 'PLAYER']),
  occurredAt: z.iso.datetime({ offset: true }),
  receiptId: postgresUuidSchema
}))

export const liveSessionPublishInputSchema = lazySchema(() =>
  z.strictObject({
    ...liveSessionPublishBase(),
    command: liveSessionScenePublicationDtoSchema,
    expectedSceneResult: sceneCommandResultDtoSchema
  })
)

export const liveSessionPublishResponseSchema = lazySchema(() =>
  z.strictObject({
    scope: z.literal('SCENE'),
    authority: liveSessionAuthorityDtoSchema,
    sceneResult: sceneCommandResultDtoSchema
  })
)

export type LiveSessionScenePublicationDto = z.infer<typeof liveSessionScenePublicationDtoSchema>
export type LiveSessionBootstrapInput = z.infer<typeof liveSessionBootstrapInputSchema>
export type LiveSessionBootstrapResponse = z.infer<typeof liveSessionBootstrapResponseSchema>
export type LiveSessionActivationInput = z.infer<typeof liveSessionActivationInputSchema>
export type LiveSessionStorageRecoveryInput = z.infer<typeof liveSessionStorageRecoveryInputSchema>
export type LiveSessionDrainReleaseInput = z.infer<typeof liveSessionDrainReleaseInputSchema>
export type LiveSessionAuthorityDto = z.infer<typeof liveSessionAuthorityDtoSchema>
export type LiveSessionPublishInput = z.infer<typeof liveSessionPublishInputSchema>
