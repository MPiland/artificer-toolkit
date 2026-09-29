import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  characterStoredCommandReceiptSchema,
  characterStoredDraftPayloadChunkSchema,
  characterStoredDraftPayloadHeadSchema,
  characterStoredDraftSchema,
  characterStoredPlayStateSchema,
  characterStoredRecordSchema
} from '@artificer-toolkit/schema/projections/characterPersistence'

export const characterTables = {
  characters: defineTable(zodToConvexFields(characterStoredRecordSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_userId', ['userId'])
    .index('by_portraitAssetId', ['portraitAssetId'])
    .index('by_userId_systemId_id', ['userId', 'systemId', 'id']),
  characterPlayStates: defineTable(zodToConvexFields(characterStoredPlayStateSchema.shape)).index(
    'by_characterId',
    ['characterId']
  ),
  characterDrafts: defineTable(zodToConvexFields(characterStoredDraftSchema.shape))
    .index('by_characterId', ['characterId'])
    .index('by_userId_systemId_characterId', ['userId', 'systemId', 'characterId'])
    .index('by_userId_updatedAt', ['userId', 'updatedAt']),
  characterDraftPayloads: defineTable(
    zodToConvexFields(characterStoredDraftPayloadHeadSchema.shape)
  )
    .index('by_characterId_id', ['characterId', 'id'])
    .index('by_importJobId_id', ['importJobId', 'id']),
  characterDraftPayloadChunks: defineTable({
    ...zodToConvexFields(characterStoredDraftPayloadChunkSchema.shape),
    bytes: v.bytes()
  }).index('by_characterId_payloadId_chunkIndex', ['characterId', 'payloadId', 'chunkIndex']),
  characterCommandReceipts: defineTable(
    zodToConvexFields(characterStoredCommandReceiptSchema.shape)
  )
    .index('by_characterId_commandId', ['characterId', 'commandId'])
    .index('by_characterId_occurredAt_id', ['characterId', 'occurredAt', 'id'])
    .index('by_characterId_actorId_occurredAt_id', ['characterId', 'actorId', 'occurredAt', 'id'])
}
