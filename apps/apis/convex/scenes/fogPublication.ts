import type { SceneFogCommandResult } from '@artificer-toolkit/schema/api/sceneFog'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  sceneStoredFogLayerSchema,
  sceneStoredFogSaveSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { parseFogLayer } from './fogDocuments'
import { advanceLiveState } from './liveDocuments'
import type { MutationCtx } from '../_generated/server'

export async function publishFogLayer(
  ctx: MutationCtx,
  save: ReturnType<typeof sceneStoredFogSaveSchema.parse>,
  header: SceneLiveStateHeader,
  state: ReturnType<typeof advanceLiveState>
): Promise<{
  patch: SceneFogCommandResult['patch']
  previousLayer: ReturnType<typeof sceneStoredFogLayerSchema.parse> | null
}> {
  const existingRow = await ctx.db
    .query('sceneFogLayers')
    .withIndex('by_sceneId_ownerUserId', (q) =>
      q.eq('sceneId', header.id).eq('ownerUserId', save.input.layer.ownerUserId)
    )
    .unique()
  const existing = existingRow ? parseFogLayer(existingRow, header.version) : null
  if (existing && existing.version > save.input.expectedSceneVersion)
    throw new Error('Scene fog layer changed before this command completed.')
  if (
    existing &&
    (existing.width !== save.input.layer.width || existing.height !== save.input.layer.height)
  )
    throw new Error('Scene fog layer dimensions cannot change.')
  const incoming = save.input.chunkManifest.map((chunk, ordinal) => ({
    index: chunk.index,
    saveId: save.id,
    ordinal,
    checksum: chunk.checksum
  }))
  const chunks =
    existing && !save.geometrySaveId
      ? Array.from(
          new Map([...existing.chunks, ...incoming].map((chunk) => [chunk.index, chunk])).values()
        ).sort((left, right) => left.index - right.index)
      : incoming
  if (chunks.length > 256) throw new Error('Scene fog layer has too many chunks.')
  let ordinal: number
  if (existing) ordinal = existing.ordinal
  else {
    if (state.fogLayerCount >= 101) throw new Error('Scene has too many fog layers.')
    ordinal = state.nextFogOrdinal++
    state.fogLayerCount += 1
  }
  const content = {
    sceneId: header.id,
    ownerUserId: save.input.layer.ownerUserId,
    width: save.input.layer.width,
    height: save.input.layer.height,
    ordinal,
    version: state.version,
    chunks
  }
  const layer = sceneStoredFogLayerSchema.parse({
    ...content,
    checksum: checksumCanonicalJson(content)
  })
  if (existingRow) await ctx.db.replace(existingRow._id, layer)
  else await ctx.db.insert('sceneFogLayers', layer)
  return {
    patch: {
      saveId: save.id,
      ownerUserId: layer.ownerUserId,
      width: layer.width,
      height: layer.height,
      chunkCount: save.input.chunkManifest.length
    },
    previousLayer: existing
  }
}
