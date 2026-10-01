import {
  sceneStoredFogSaveSchema,
  sceneStoredFogLayerSchema,
  sceneStoredFogChunkSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

export function parseSceneFogSave(value: unknown) {
  const save = sceneStoredFogSaveSchema.parse(value)
  if (
    save.sceneId !== save.input.sceneId ||
    save.commandId !== save.input.commandId ||
    save.inputChecksum !== checksumCanonicalJson(save.input) ||
    save.receivedChunks > save.input.chunkManifest.length ||
    (save.chunksRemoved && save.status !== 'EXPIRED') ||
    (save.status === 'PUBLISHED' &&
      (save.chunksRemoved || save.receivedChunks !== save.input.chunkManifest.length))
  )
    throw new Error('Stored Scene fog save is inconsistent.')
  return save
}

export function parseSceneFogLayer(value: unknown, version: number) {
  const layer = sceneStoredFogLayerSchema.parse(value)
  const { checksum, ...content } = layer
  if (
    checksum !== checksumCanonicalJson(content) ||
    layer.version > version ||
    new Set(layer.chunks.map((chunk) => chunk.index)).size !== layer.chunks.length
  )
    throw new Error('Stored Scene fog layer is inconsistent.')
  return layer
}

export function parseSceneReferencedFogChunk(
  saveValue: unknown,
  chunkValue: unknown,
  reference: ReturnType<typeof sceneStoredFogLayerSchema.parse>['chunks'][number],
  sceneId: string,
  layer: ReturnType<typeof sceneStoredFogSaveSchema.parse>['input']['layer']
) {
  if (!saveValue || !chunkValue) throw new Error('Stored Scene fog chunk is unavailable.')
  const save = parseSceneFogSave(saveValue)
  const chunk = sceneStoredFogChunkSchema.parse(chunkValue)
  const manifest = save.input.chunkManifest[reference.ordinal]
  if (
    save.sceneId !== sceneId ||
    save.status !== 'PUBLISHED' ||
    save.input.layer.ownerUserId !== layer.ownerUserId ||
    save.input.layer.width !== layer.width ||
    save.input.layer.height !== layer.height ||
    chunk.saveId !== save.id ||
    chunk.ordinal !== reference.ordinal ||
    chunk.chunk.index !== reference.index ||
    chunk.checksum !== reference.checksum ||
    chunk.checksum !== checksumCanonicalJson(chunk.chunk) ||
    manifest?.index !== reference.index ||
    manifest.checksum !== reference.checksum ||
    chunk.chunk.x + chunk.chunk.width > save.input.layer.width ||
    chunk.chunk.y + chunk.chunk.height > save.input.layer.height
  )
    throw new Error('Stored Scene fog chunk is inconsistent.')
  return chunk.chunk
}
