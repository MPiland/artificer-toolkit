import { sceneGeometryFinishInputSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { sceneStoredLiveEntitySchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { readSpatialSceneGeometry as readSharedSpatialSceneGeometry } from '@artificer-toolkit/encounter-persistence/spatialSceneGeometry'
import type { MutationCtx } from '../_generated/server'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { readGeometrySave } from './geometryDocuments'

/** Ordinals are lookup hints only. A supplied save must come from this transaction, before any writes. */
export async function readSpatialSceneGeometry(
  ctx: MutationCtx,
  saveId: string,
  hints: NonNullable<ReturnType<typeof sceneGeometryFinishInputSchema.parse>['tokenOrdinals']>,
  currentSave?: Awaited<ReturnType<typeof readGeometrySave>>
) {
  return readSharedSpatialSceneGeometry(
    encounterWriteTransaction(ctx),
    saveId,
    hints,
    {
      readGeometrySave: (id) => readGeometrySave(ctx, id),
      readLiveToken: async (sceneId, tokenId) => {
        const row = await ctx.db
          .query('sceneLiveEntities')
          .withIndex('by_sceneId_collection_entityId', (q) =>
            q.eq('sceneId', sceneId).eq('collection', 'tokens').eq('entityId', tokenId)
          )
          .unique()
        if (!row) return null
        const { _id, _creationTime, ...stored } = row
        return sceneStoredLiveEntitySchema.parse(stored)
      },
      readDefinitionToken: async (definitionSaveId, ordinal) => {
        const row = await ctx.db
          .query('sceneDefinitionEntities')
          .withIndex('by_saveId_collection_ordinal', (q) =>
            q.eq('saveId', definitionSaveId).eq('value.collection', 'tokens').eq('ordinal', ordinal)
          )
          .unique()
        if (!row) return null
        const { _id, _creationTime, ...stored } = row
        return sceneStoredDefinitionEntitySchema.parse(stored)
      }
    },
    currentSave
  )
}
