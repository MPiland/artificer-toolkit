import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  characterStoredDraftPayloadChunkSchema,
  characterStoredDraftPayloadHeadSchema,
  characterStoredDraftSchema,
  characterStoredPlayStateSchema,
  characterStoredHeadSchema
} from '@artificer-toolkit/schema/projections/characterPersistence'
import {
  characterStoredBuildStateSchema,
  characterCollectionSchemas
} from '@artificer-toolkit/schema/projections/characterOperationalRecords'
import { characterCommandReceiptHeaderSchema } from '@artificer-toolkit/schema/projections/receiptHeaderPersistence'
import {
  characterSheetDerivationRecordSchema,
  characterSheetSectionRecordSchema
} from '@artificer-toolkit/schema/projections/characterSheetSections'

export const characterTables = {
  characters: defineTable(zodToConvexFields(characterStoredHeadSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_userId', ['userId'])
    .index('by_portraitAssetId', ['portraitAssetId'])
    .index('by_userId_systemId_id', ['userId', 'systemId', 'id']),
  characterPlayStates: defineTable(zodToConvexFields(characterStoredPlayStateSchema.shape)).index(
    'by_characterId',
    ['characterId']
  ),
  characterBuildStates: defineTable(zodToConvexFields(characterStoredBuildStateSchema.shape)).index(
    'by_characterId',
    ['characterId']
  ),
  characterInventoryItems: defineTable(
    zodToConvexFields(characterCollectionSchemas.characterInventoryItems.shape)
  )
    .index('by_characterId_id', ['characterId', 'id'])
    .index('by_characterId_position', ['characterId', 'position']),
  characterCurrencyGroups: defineTable(
    zodToConvexFields(characterCollectionSchemas.characterCurrencyGroups.shape)
  )
    .index('by_characterId_id', ['characterId', 'id'])
    .index('by_characterId_position', ['characterId', 'position']),
  characterClassSpellStates: defineTable(
    zodToConvexFields(characterCollectionSchemas.characterClassSpellStates.shape)
  )
    .index('by_characterId_id', ['characterId', 'id'])
    .index('by_characterId_position', ['characterId', 'position']),
  characterSpellCustomizations: defineTable(
    zodToConvexFields(characterCollectionSchemas.characterSpellCustomizations.shape)
  )
    .index('by_characterId_id', ['characterId', 'id'])
    .index('by_characterId_position', ['characterId', 'position']),
  characterCreatureInstances: defineTable(
    zodToConvexFields(characterCollectionSchemas.characterCreatureInstances.shape)
  )
    .index('by_characterId_id', ['characterId', 'id'])
    .index('by_characterId_position', ['characterId', 'position']),
  characterVehicleInstances: defineTable(
    zodToConvexFields(characterCollectionSchemas.characterVehicleInstances.shape)
  )
    .index('by_characterId_id', ['characterId', 'id'])
    .index('by_characterId_position', ['characterId', 'position']),
  characterNotes: defineTable(zodToConvexFields(characterCollectionSchemas.characterNotes.shape))
    .index('by_characterId_id', ['characterId', 'id'])
    .index('by_characterId_position', ['characterId', 'position']),
  characterNoteGroups: defineTable(
    zodToConvexFields(characterCollectionSchemas.characterNoteGroups.shape)
  )
    .index('by_characterId_id', ['characterId', 'id'])
    .index('by_characterId_position', ['characterId', 'position']),
  characterExtraEquipment: defineTable(
    zodToConvexFields(characterCollectionSchemas.characterExtraEquipment.shape)
  )
    .index('by_characterId_id', ['characterId', 'id'])
    .index('by_characterId_position', ['characterId', 'position']),
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
  characterSheetDerivations: defineTable(
    zodToConvexFields(characterSheetDerivationRecordSchema.shape)
  ).index('by_characterId', ['characterId']),
  characterSheetSections: defineTable(
    zodToConvexFields(characterSheetSectionRecordSchema.shape)
  ).index('by_characterId_viewer_section', ['characterId', 'viewer', 'section']),
  characterCommandReceipts: defineTable(
    zodToConvexFields(characterCommandReceiptHeaderSchema.shape)
  )
    .index('by_ledgerId_entryIndex', ['ledgerId', 'entryIndex'])
    .index('by_characterId_commandId', ['characterId', 'commandId'])
    .index('by_characterId_occurredAt_id', ['characterId', 'occurredAt', 'id'])
    .index('by_characterId_actorId_occurredAt_id', ['characterId', 'actorId', 'occurredAt', 'id'])
}
