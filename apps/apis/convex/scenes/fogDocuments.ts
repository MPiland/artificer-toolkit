import {
  sceneStoredFogSaveSchema,
  sceneStoredFogLayerSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import {
  sceneStoredFogCommandSchema,
  type sceneStoredLiveCommandSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
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

export function parseFogCommand(
  value: ReturnType<typeof sceneStoredLiveCommandSchema.parse>,
  version: number
) {
  if (value.encoding !== 'FOG_PATCH') throw new Error('Scene command is not a paged fog patch.')
  const command = sceneStoredFogCommandSchema.parse(value)
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
