import {
  sceneUndoCommandResultSchema,
  type SceneUndoCommandResult,
  type SceneUndoExecuteInput
} from '@artificer-toolkit/schema/api/sceneUndo'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  sceneStoredFogLayerSchema,
  type sceneStoredFogSaveSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import type { SceneStoredGeometrySave } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import {
  sceneStoredUndoCommandSchema,
  type sceneStoredLiveCommandSchema,
  type sceneStoredLiveEntitySchema,
  type sceneStoredLiveStateSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  parseGeometryCommand,
  parseGeometrySave,
  readMovementResolution,
  readSpatialPreparation
} from './sceneGeometryDocuments.js'
import { parseSceneFogSave, parseSceneFogLayer } from './sceneFogDocuments.js'
import { advanceLiveState, parseSceneLiveEntity } from './sceneLiveState.js'

export type SceneUndoPublicationCallbacks = {
  readSceneCommand(
    sceneId: string,
    commandId: string
  ): Promise<ReturnType<typeof sceneStoredLiveCommandSchema.parse> | null>
  readUndoForMove(
    sceneId: string,
    commandId: string
  ): Promise<ReturnType<typeof sceneStoredLiveCommandSchema.parse> | null>
  readGeometrySave(sceneId: string, commandId: string): Promise<SceneStoredGeometrySave | null>
  readLiveToken(
    sceneId: string,
    tokenId: string
  ): Promise<ReturnType<typeof sceneStoredLiveEntitySchema.parse> | null>
  readFogSave(saveId: string): Promise<ReturnType<typeof sceneStoredFogSaveSchema.parse> | null>
  readFogLayer(
    sceneId: string,
    ownerUserId: string | null
  ): Promise<ReturnType<typeof sceneStoredFogLayerSchema.parse> | null>
  writeFogLayer(value: ReturnType<typeof sceneStoredFogLayerSchema.parse>): Promise<void>
  deleteFogLayer(sceneId: string, ownerUserId: string | null): Promise<void>
  writeLiveToken(value: ReturnType<typeof sceneStoredLiveEntitySchema.parse>): Promise<void>
  writeLiveState(value: ReturnType<typeof sceneStoredLiveStateSchema.parse>): Promise<void>
  insertUndoCommand(value: ReturnType<typeof sceneStoredUndoCommandSchema.parse>): Promise<void>
}

function assertPreviousLayer(
  layer: NonNullable<ReturnType<typeof sceneStoredFogSaveSchema.parse>['previousLayer']>,
  parent: ReturnType<typeof parseGeometrySave>,
  sceneId: string,
  ownerUserId: string | null,
  width: number,
  height: number
) {
  const parsed = sceneStoredFogLayerSchema.parse(layer)
  const { checksum, ...content } = parsed
  if (
    checksum !== checksumCanonicalJson(content) ||
    parsed.sceneId !== sceneId ||
    parsed.ownerUserId !== ownerUserId ||
    parsed.width !== width ||
    parsed.height !== height ||
    parsed.version > parent.snapshotVersion ||
    new Set(parsed.chunks.map((reference) => reference.index)).size !== parsed.chunks.length
  )
    throw new Error('Stored Scene fog snapshot is inconsistent.')
  return parsed
}

/** Publishes a selected move's undo within the caller's admitted Scene transaction. */
export async function publishSceneUndo(
  context: {
    header: SceneLiveStateHeader
    live: ReturnType<typeof sceneStoredLiveStateSchema.parse> | null
    userId: string
    input: SceneUndoExecuteInput
    targetCommandId: string
  },
  callbacks: SceneUndoPublicationCallbacks
): Promise<SceneUndoCommandResult> {
  const { header, live, userId, input, targetCommandId } = context
  const inputChecksum = checksumCanonicalJson(input.input)
  const targetRow = await callbacks.readSceneCommand(header.id, targetCommandId)
  if (!targetRow || targetRow.encoding !== 'GEOMETRY')
    throw new Error('The latest token move is unavailable.')
  const target = parseGeometryCommand(targetRow, header.version)
  const moved = target.result.delta
  const deltas = moved?.kind === 'BATCH' ? moved.deltas : moved ? [moved] : []
  const movedTokens = deltas.flatMap((delta) => (delta.kind === 'TOKEN_MOVED' ? [delta] : []))
  if (
    target.input.type !== 'MOVE_SCENE_TOKEN' ||
    !movedTokens.length ||
    movedTokens.length !== deltas.length ||
    movedTokens[0]!.tokenId !== target.input.tokenId
  )
    throw new Error('The latest token move is invalid.')
  const alreadyUndone = await callbacks.readUndoForMove(header.id, target.commandId)
  if (alreadyUndone) throw new Error('The latest token move was already undone.')

  const parentRow = await callbacks.readGeometrySave(header.id, target.commandId)
  if (!parentRow) throw new Error('Stored Scene geometry save is inconsistent.')
  const parent = parseGeometrySave(parentRow)
  if (
    parent.status !== 'PUBLISHED' ||
    parent.inputChecksum !== target.inputChecksum ||
    parent.input.type !== 'MOVE_SCENE_TOKEN'
  )
    throw new Error('Stored Scene geometry save is inconsistent.')
  if (
    parent.fogSaves.length !== target.result.fogPatches.length ||
    new Set(parent.fogSaves.map((reference) => reference.saveId)).size !== parent.fogSaves.length
  )
    throw new Error('Stored Scene geometry fog history is inconsistent.')

  // The mover returns to where the move began; each token it dragged to where it stood (D105).
  const dragged = readSpatialPreparation(parent)?.draggedTokens ?? []
  if (
    dragged.length !== movedTokens.length - 1 ||
    dragged.some(
      ({ tokenId, to }, index) =>
        movedTokens[index + 1]!.tokenId !== tokenId ||
        checksumCanonicalJson(to) !== checksumCanonicalJson(movedTokens[index + 1]!.position)
    )
  )
    throw new Error('Stored Scene drag is inconsistent.')
  const restores = [
    {
      tokenId: target.input.tokenId,
      position: readMovementResolution(parent)?.root.currentPosition ?? target.input.path[0]!,
      // A move that chose a facing turns its token back to the one it replaced (ATTACK-12).
      rotationDegrees: target.priorRotationDegrees
    },
    ...dragged.map(({ tokenId, from }) => ({ tokenId, position: from, rotationDegrees: undefined }))
  ]
  const tokens = []
  for (const { tokenId, position, rotationDegrees } of restores) {
    const tokenRow = await callbacks.readLiveToken(header.id, tokenId)
    if (!tokenRow) throw new Error('The latest token move can no longer be safely undone.')
    const token = parseSceneLiveEntity(tokenRow, header.version)
    if (token.version !== target.result.version || token.value?.collection !== 'tokens')
      throw new Error('The latest token move can no longer be safely undone.')
    tokens.push({ token, value: token.value, position, rotationDegrees })
  }

  const state = advanceLiveState(header, live)
  const restoredFogOwners: (string | null)[] = []
  for (const patch of target.result.fogPatches) {
    const childRow = await callbacks.readFogSave(patch.saveId)
    if (!childRow) throw new Error('Stored Scene fog save is inconsistent.')
    const child = parseSceneFogSave(childRow)
    const parentReference = parent.fogSaves.find((reference) => reference.saveId === patch.saveId)
    if (
      child.id !== patch.saveId ||
      child.geometrySaveId !== parent.id ||
      child.sceneId !== header.id ||
      child.actorUserId !== target.actorUserId ||
      child.status !== 'PUBLISHED' ||
      child.chunksRemoved ||
      child.input.layer.ownerUserId !== patch.ownerUserId ||
      child.input.layer.width !== patch.width ||
      child.input.layer.height !== patch.height ||
      child.input.chunkManifest.length !== patch.chunkCount ||
      parentReference?.ownerUserId !== patch.ownerUserId ||
      child.previousLayer === undefined
    )
      throw new Error('Stored Scene fog save is inconsistent.')
    const currentRow = await callbacks.readFogLayer(header.id, patch.ownerUserId)
    if (!currentRow) throw new Error('The latest token move can no longer be safely undone.')
    const current = parseSceneFogLayer(currentRow, header.version)
    if (current.version !== target.result.version)
      throw new Error('The latest token move can no longer be safely undone.')
    const previous = child.previousLayer
    if (previous !== null) {
      const validated = assertPreviousLayer(
        previous,
        parent,
        header.id,
        patch.ownerUserId,
        patch.width,
        patch.height
      )
      const { checksum: _checksum, ...content } = validated
      const restored = sceneStoredFogLayerSchema.parse({
        ...content,
        version: state.version,
        checksum: checksumCanonicalJson({ ...content, version: state.version })
      })
      await callbacks.writeFogLayer(restored)
    } else {
      if (state.fogLayerCount <= 0) throw new Error('Stored Scene fog state is inconsistent.')
      state.fogLayerCount -= 1
      await callbacks.deleteFogLayer(header.id, patch.ownerUserId)
    }
    restoredFogOwners.push(patch.ownerUserId)
  }
  for (const { token, value, position, rotationDegrees } of tokens) {
    const restoredToken = {
      sceneId: header.id,
      collection: token.collection,
      entityId: token.entityId,
      value: {
        ...value,
        entity: {
          ...value.entity,
          position,
          ...(rotationDegrees !== undefined && { rotationDegrees })
        }
      },
      doorState: token.doorState,
      ordinal: token.ordinal,
      version: state.version
    }
    await callbacks.writeLiveToken({
      ...restoredToken,
      checksum: checksumCanonicalJson(restoredToken)
    })
  }
  const undone = restores.map(({ tokenId, position, rotationDegrees }) => ({
    kind: 'TOKEN_MOVE_UNDONE' as const,
    tokenId,
    position,
    ...(rotationDegrees !== undefined && { rotationDegrees }),
    undoneCommandId: target.commandId
  }))
  const result = sceneUndoCommandResultSchema.parse({
    sceneId: header.id,
    commandId: input.input.commandId,
    version: state.version,
    replayed: false,
    occurrence: null,
    delta: undone.length === 1 ? undone[0] : { kind: 'BATCH', deltas: undone },
    restoredFogOwners
  })
  await callbacks.writeLiveState(state)
  await callbacks.insertUndoCommand(
    sceneStoredUndoCommandSchema.parse({
      encoding: 'UNDO',
      sceneId: header.id,
      commandId: input.input.commandId,
      actorUserId: userId,
      input: input.input,
      inputChecksum,
      result,
      resultChecksum: checksumCanonicalJson(result),
      undoneCommandId: target.commandId
    })
  )
  return result
}
