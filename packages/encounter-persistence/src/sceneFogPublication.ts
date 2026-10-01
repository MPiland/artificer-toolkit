import type { SceneFogCommandResult } from '@artificer-toolkit/schema/api/sceneFog'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  sceneStoredFogLayerSchema,
  type sceneStoredFogSaveSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { advanceLiveState } from './sceneLiveState.js'

/** Plans a fog layer and advances the supplied live state's counters for a new layer. */
export function planSceneFogPublication(
  save: ReturnType<typeof sceneStoredFogSaveSchema.parse>,
  header: SceneLiveStateHeader,
  state: ReturnType<typeof advanceLiveState>,
  existing: ReturnType<typeof sceneStoredFogLayerSchema.parse> | null
): {
  layer: ReturnType<typeof sceneStoredFogLayerSchema.parse>
  patch: SceneFogCommandResult['patch']
  previousLayer: ReturnType<typeof sceneStoredFogLayerSchema.parse> | null
} {
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
  return {
    layer,
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
