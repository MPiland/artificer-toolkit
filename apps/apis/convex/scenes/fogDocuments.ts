import {
  sceneStoredFogSaveSchema,
  sceneStoredFogLayerSchema,
  sceneStoredFogChunkSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import { sceneStoredFogCommandSchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readLiveScene } from './liveDocuments'

function stored<T extends { _id: unknown; _creationTime: unknown }>(row: T) {
  const { _id, _creationTime, ...value } = row
  return value
}

export function parseFogSave(row: Doc<'sceneFogSaves'>) {
  const save = sceneStoredFogSaveSchema.parse(stored(row))
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
  const layer = sceneStoredFogLayerSchema.parse(stored(row))
  const { checksum, ...content } = layer
  if (
    checksum !== checksumCanonicalJson(content) ||
    layer.version > version ||
    new Set(layer.chunks.map((chunk) => chunk.index)).size !== layer.chunks.length
  )
    throw new Error('Stored Scene fog layer is inconsistent.')
  return layer
}

export function parseFogCommand(row: Doc<'sceneLiveCommands'>, version: number) {
  if (row.encoding !== 'FOG_PATCH') throw new Error('Scene command is not a paged fog patch.')
  const command = sceneStoredFogCommandSchema.parse(stored(row))
  if (
    command.inputChecksum !== checksumCanonicalJson(command.input) ||
    command.resultChecksum !== checksumCanonicalJson(command.result) ||
    command.input.sceneId !== command.sceneId ||
    command.input.commandId !== command.commandId ||
    command.result.sceneId !== command.sceneId ||
    command.result.commandId !== command.commandId ||
    command.result.replayed ||
    command.result.version > version ||
    command.result.patch.chunkCount !== command.input.chunkManifest.length ||
    command.result.patch.ownerUserId !== command.input.layer.ownerUserId ||
    command.result.patch.width !== command.input.layer.width ||
    command.result.patch.height !== command.input.layer.height
  )
    throw new Error('Stored Scene fog command is inconsistent.')
  return command
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
  if (!saveRow || !chunkRow) throw new Error('Stored Scene fog chunk is unavailable.')
  const save = parseFogSave(saveRow)
  const chunk = sceneStoredFogChunkSchema.parse(stored(chunkRow))
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
