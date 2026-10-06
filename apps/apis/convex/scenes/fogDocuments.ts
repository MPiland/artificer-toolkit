import {
  sceneStoredFogSaveSchema,
  sceneStoredFogLayerSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readLiveScene } from './liveDocuments'
import {
  parseSceneFogSave,
  parseSceneFogLayer,
  parseSceneReferencedFogChunk
} from '@artificer-toolkit/encounter-persistence/sceneFogDocuments'

function stored<T extends { _id: unknown; _creationTime: unknown }>(row: T) {
  const { _id, _creationTime, ...value } = row
  return value
}

export function parseFogSave(row: Doc<'sceneFogSaves'>) {
  return parseSceneFogSave(stored(row))
}

export async function readFogSave(ctx: QueryCtx, saveId: string) {
  const row = await ctx.db
    .query('sceneFogSaves')
    .withIndex('by_publicId', (q) => q.eq('id', saveId.toLowerCase()))
    .unique()
  if (!row) throw new Error('Scene fog save is unavailable.')
  const scene = await readLiveScene(ctx, row.sceneId, 'OWNER')
  return { ...scene, row, save: parseFogSave(row) }
}

export function parseFogLayer(row: Doc<'sceneFogLayers'>, version: number) {
  return parseSceneFogLayer(stored(row), version)
}

export async function readFogChunk(
  ctx: QueryCtx,
  reference: ReturnType<typeof sceneStoredFogLayerSchema.parse>['chunks'][number],
  sceneId: string,
  layer: ReturnType<typeof sceneStoredFogSaveSchema.parse>['input']['layer']
) {
  const [saveRow, chunkRow] = await Promise.all([
    ctx.db
      .query('sceneFogSaves')
      .withIndex('by_publicId', (q) => q.eq('id', reference.saveId))
      .unique(),
    ctx.db
      .query('sceneFogChunks')
      .withIndex('by_saveId_ordinal', (q) =>
        q.eq('saveId', reference.saveId).eq('ordinal', reference.ordinal)
      )
      .unique()
  ])
  return parseReferencedFogChunk(saveRow, chunkRow, reference, sceneId, layer)
}

/** Publication can reuse already loaded save metadata instead of rereading it for every tile. */
export function parseReferencedFogChunk(
  saveRow: Doc<'sceneFogSaves'> | null,
  chunkRow: Doc<'sceneFogChunks'> | null,
  reference: ReturnType<typeof sceneStoredFogLayerSchema.parse>['chunks'][number],
  sceneId: string,
  layer: ReturnType<typeof sceneStoredFogSaveSchema.parse>['input']['layer']
) {
  return parseSceneReferencedFogChunk(
    saveRow ? stored(saveRow) : null,
    chunkRow ? stored(chunkRow) : null,
    reference,
    sceneId,
    layer
  )
}
