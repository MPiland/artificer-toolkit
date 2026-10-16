import {
  publishSceneUndo,
  type SceneUndoPublicationCallbacks
} from '@artificer-toolkit/encounter-persistence/sceneUndoPublication'
import { parseGeometryCommand } from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { normalizeSceneGeometryEntity } from '@artificer-toolkit/encounter-persistence/sceneGeometryValues'
import {
  sceneUndoExecuteInputSchema,
  type SceneUndoExecuteInput
} from '@artificer-toolkit/schema/api/sceneUndo'
import {
  sceneStoredLiveCommandSchema,
  sceneStoredLiveEntitySchema,
  sceneStoredUndoCommandSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import {
  sceneStoredFogSaveSchema,
  sceneStoredFogLayerSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import { liveSessionCheckpointSceneSourceSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import {
  sceneCommandResultDtoSchema,
  type CampaignSceneStateDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { applySceneDelta } from '@artificer-toolkit/shared/vtt'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SCENE_EVIDENCE_ROW, type RoomTransaction } from './roomEncounterStore.js'
import { readRoomScene, readRoomSceneFogLayer, readRoomSceneHeader } from './roomSceneRead.js'
import {
  readCommandGeometrySaves,
  readRoomSceneRow,
  writeRoomSceneRow
} from './roomSceneRecords.js'

/** The Scene has no committed token move left to undo; retrying cannot succeed. */
export class NoSceneMoveToUndoError extends Error {
  constructor() {
    super('There is no committed token move to undo.')
  }
}

/** The caller admits the GM and commits these writes with the room journal in one transaction. */
export async function publishRoomSceneUndo(input: {
  transaction: RoomTransaction
  userId: string
  scene: CampaignSceneStateDto
  request: SceneUndoExecuteInput
  /** Runs once for the move this undo reverses, in the same transaction; never on a replay. */
  onUndone?(undoneCommandId: string): Promise<void>
}) {
  const { transaction, scene, userId } = input
  const request = sceneUndoExecuteInputSchema.parse({
    ...input.request,
    input: {
      ...input.request.input,
      sceneId: input.request.input.sceneId.toLowerCase(),
      commandId: input.request.input.commandId.toLowerCase()
    }
  })
  const { header, live } = readRoomScene(transaction, request.input.sceneId)
  const sourceRecord = transaction.record('SCENE_CHECKPOINT_SOURCE', header.id)
  if (!sourceRecord) throw new Error('Room Scene source is unavailable.')
  const source = liveSessionCheckpointSceneSourceSchema.parse(JSON.parse(sourceRecord.json))
  if (
    scene.id !== header.id ||
    scene.campaignId !== header.campaignId ||
    scene.version !== header.version ||
    scene.definitionId !== header.definitionId ||
    scene.definitionVersion !== header.definitionVersion ||
    (request.presentation &&
      request.presentation.expectedPresentationVersion !== source.presentationVersion)
  )
    throw new Error('Room Scene source pins are stale.')
  const checksum = checksumCanonicalJson(request.input)
  const prior = readRoomSceneRow(transaction, 'sceneLiveCommands', [
    header.id,
    request.input.commandId
  ])
  if (prior) {
    const command = parseUndo(prior)
    if (command.inputChecksum !== checksum || command.actorUserId !== userId)
      throw new Error('Scene command ID was already used.')
    const { restoredFogOwners: _restored, ...result } = command.result
    return {
      result: sceneCommandResultDtoSchema.parse({ ...result, replayed: true }),
      scene,
      header,
      fogChanged: false
    }
  }
  if (request.input.expectedSceneVersion !== header.version)
    throw new Error('Scene version is stale.')
  // ponytail: retained Scene history is scanned; use a keyed index if the frozen workload misses its budget.
  const commands = transaction
    .records(SCENE_EVIDENCE_ROW)
    .filter((record) =>
      record.key.startsWith(canonicalizeJson(['sceneLiveCommands', header.id]).slice(0, -1) + ',')
    )
    .map((record) => sceneStoredLiveCommandSchema.parse(JSON.parse(record.json)))
  const undoForMove = (commandId: string) => {
    const matching = commands.filter(
      (command) => command.encoding === 'UNDO' && command.undoneCommandId === commandId
    )
    if (matching.length > 1) throw new Error('Stored Scene undo command is inconsistent.')
    return matching[0] ?? null
  }
  const targetCommandId = commands
    .filter(
      (command) => command.encoding === 'GEOMETRY' && command.input.type === 'MOVE_SCENE_TOKEN'
    )
    .map((command) => parseGeometryCommand(command, header.version))
    .sort((a, b) => b.result.version - a.result.version)
    .find((command) => {
      if (command.result.delta === null && command.result.fogPatches.length === 0) return false
      const undone = undoForMove(command.commandId)
      if (undone) {
        parseUndo(undone)
        return false
      }
      return true
    })?.commandId
  if (!targetCommandId) throw new NoSceneMoveToUndoError()
  const callbacks: SceneUndoPublicationCallbacks = {
    readSceneCommand: async (sceneId, commandId) => {
      const value = readRoomSceneRow(transaction, 'sceneLiveCommands', [sceneId, commandId])
      return value ? sceneStoredLiveCommandSchema.parse(value) : null
    },
    readUndoForMove: async (sceneId, commandId) => {
      if (sceneId !== header.id) throw new Error('Room undo Scene mismatch.')
      return undoForMove(commandId)
    },
    readGeometrySave: async (sceneId, commandId) => {
      const saves = readCommandGeometrySaves(transaction, sceneId, commandId)
      if (saves.length > 1) throw new Error('Stored Scene geometry save is inconsistent.')
      return saves[0] ?? null
    },
    readLiveToken: async (sceneId, tokenId) => {
      const value = readRoomSceneRow(transaction, 'sceneLiveEntities', [sceneId, 'tokens', tokenId])
      if (!value) return null
      const current = scene.tokens.find((token) => token.id.toLowerCase() === tokenId)
      const token = sceneStoredLiveEntitySchema.parse(value)
      if (
        sceneId !== header.id ||
        !current ||
        canonicalizeJson(
          normalizeSceneGeometryEntity({ collection: 'tokens', entity: current })
        ) !== canonicalizeJson(token.value)
      )
        throw new Error('The token move can no longer be safely undone.')
      return token
    },
    readFogSave: async (id) => {
      const value = readRoomSceneRow(transaction, 'sceneFogSaves', [id])
      return value ? sceneStoredFogSaveSchema.parse(value) : null
    },
    readFogLayer: async (sceneId, owner) => {
      const value = readRoomSceneRow(transaction, 'sceneFogLayers', [sceneId, owner])
      return value ? sceneStoredFogLayerSchema.parse(value) : null
    },
    writeFogLayer: async (value) => {
      writeRoomSceneRow(transaction, 'sceneFogLayers', value)
    },
    deleteFogLayer: async (sceneId, owner) => {
      transaction.deleteRecord(
        'SCENE_CHECKPOINT_ROW',
        canonicalizeJson(['sceneFogLayers', sceneId, owner])
      )
    },
    writeLiveToken: async (value) => {
      writeRoomSceneRow(transaction, 'sceneLiveEntities', value)
    },
    writeLiveState: async (value) => {
      writeRoomSceneRow(transaction, 'sceneLiveStates', value)
    },
    insertUndoCommand: async (value) => {
      writeRoomSceneRow(transaction, 'sceneLiveCommands', value)
    }
  }
  const { restoredFogOwners, ...result } = await publishSceneUndo(
    { header, live, userId, input: request, targetCommandId },
    callbacks
  )
  await input.onUndone?.(targetCommandId)
  const restoredOwners = new Set(restoredFogOwners)
  const fogLayers = scene.fogLayers.filter((layer) => !restoredOwners.has(layer.ownerUserId))
  for (const owner of restoredFogOwners) {
    const layer = readRoomSceneFogLayer(transaction, header.id, owner, result.version)
    if (layer) fogLayers.push(layer)
  }
  return {
    result: sceneCommandResultDtoSchema.parse(result),
    scene: { ...applySceneDelta(scene, result.delta, result.version), fogLayers },
    header: readRoomSceneHeader(transaction, header.id),
    fogChanged: restoredOwners.size > 0
  }

  function parseUndo(value: unknown) {
    const command = sceneStoredUndoCommandSchema.parse(value)
    if (
      command.inputChecksum !== checksumCanonicalJson(command.input) ||
      command.resultChecksum !== checksumCanonicalJson(command.result) ||
      command.sceneId !== command.input.sceneId ||
      command.commandId !== command.input.commandId ||
      command.sceneId !== command.result.sceneId ||
      command.commandId !== command.result.commandId ||
      command.result.replayed ||
      command.result.version > header.version ||
      command.undoneCommandId !== command.result.delta.undoneCommandId
    )
      throw new Error('Stored Scene undo command is inconsistent.')
    return command
  }
}
