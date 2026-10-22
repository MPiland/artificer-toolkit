import { defineTable } from 'convex/server'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import { sceneVisionRevisionSchema } from '@artificer-toolkit/schema/projections/sceneVisionRevisions'
import {
  sceneStoredFogSaveSchema,
  sceneStoredFogChunkSchema,
  sceneStoredFogLayerSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import { storedLootSchema } from '@artificer-toolkit/schema/projections/lootPersistence'
import {
  sceneStoredLiveStateSchema,
  sceneStoredLiveEntitySchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import {
  sceneStoredDefinitionSchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredDefinitionEntitySchema,
  sceneStoredInitialStateSchema,
  sceneStoredPresentationSchema,
  sceneStoredShowingSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'

export const sceneTables = {
  lootTables: defineTable(zodToConvexFields(storedLootSchema.shape))
    .index('by_scene', ['owner.kind', 'owner.sceneDefinitionId'])
    .index('by_actor', ['owner.kind', 'owner.encounterId', 'owner.actorId'])
    .index('by_campaignId', ['owner.campaignId']),
  sceneVisionRevisions: defineTable(zodToConvexFields(sceneVisionRevisionSchema.shape)).index(
    'by_scope_id',
    ['scope', 'id']
  ),
  sceneFogSaves: defineTable(zodToConvexFields(sceneStoredFogSaveSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_sceneId_commandId', ['sceneId', 'commandId']),
  sceneFogChunks: defineTable(zodToConvexFields(sceneStoredFogChunkSchema.shape)).index(
    'by_saveId_ordinal',
    ['saveId', 'ordinal']
  ),
  sceneFogLayers: defineTable(zodToConvexFields(sceneStoredFogLayerSchema.shape))
    .index('by_sceneId_ownerUserId', ['sceneId', 'ownerUserId'])
    .index('by_sceneId_ordinal', ['sceneId', 'ordinal']),
  sceneLiveStates: defineTable(zodToConvexFields(sceneStoredLiveStateSchema.shape)).index(
    'by_sceneId',
    ['sceneId']
  ),
  sceneLiveEntities: defineTable(zodToConvexFields(sceneStoredLiveEntitySchema.shape))
    .index('by_sceneId_collection_entityId', ['sceneId', 'collection', 'entityId'])
    .index('by_sceneId_collection_ordinal', ['sceneId', 'collection', 'ordinal']),
  campaignScenePresentations: defineTable(zodToConvexFields(sceneStoredPresentationSchema.shape))
    .index('by_campaignId', ['campaignId'])
    .index('by_campaignId_activeMapAssetId', ['campaignId', 'activeMapAssetId']),
  campaignSceneShowings: defineTable(zodToConvexFields(sceneStoredShowingSchema.shape)).index(
    'by_campaignId',
    ['campaignId']
  ),
  sceneDefinitions: defineTable(zodToConvexFields(sceneStoredDefinitionSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_campaignId_updatedAt_id', ['campaignId', 'updatedAt', 'id'])
    .index('by_saveId', ['saveId'])
    .index('by_mapAssetId', ['map.assetId']),
  sceneDefinitionSaves: defineTable(zodToConvexFields(sceneStoredDefinitionSaveSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_ownerUserId_commandId', ['ownerUserId', 'commandId'])
    .index('by_campaignId_commandId', ['settings.campaignId', 'commandId']),
  sceneDefinitionEntities: defineTable(zodToConvexFields(sceneStoredDefinitionEntitySchema.shape))
    .index('by_saveId_collection_ordinal', ['saveId', 'value.collection', 'ordinal'])
    .index('by_saveId_collection_entityId', ['saveId', 'value.collection', 'entityId'])
    .index('by_saveId', ['saveId']),
  campaignScenes: defineTable(zodToConvexFields(sceneStoredInitialStateSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_campaignId_createdAt_id', ['campaignId', 'createdAt', 'id'])
    .index('by_definitionSaveId', ['definitionSaveId'])
    .index('by_mapAssetId', ['map.assetId'])
}
