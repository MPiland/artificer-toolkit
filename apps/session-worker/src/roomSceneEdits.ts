import { planSceneInlineCommand } from '@artificer-toolkit/encounter-persistence/sceneInlineCommand'
import {
  parseSceneFogLayer,
  parseSceneReferencedFogChunk
} from '@artificer-toolkit/encounter-persistence/sceneFogDocuments'
import { planSceneFogPublication } from '@artificer-toolkit/encounter-persistence/sceneFogPublication'
import { advanceLiveState } from '@artificer-toolkit/encounter-persistence/sceneLiveState'
import type { LiveSessionCommandRejectionCodeDto } from '@artificer-toolkit/schema/api/liveSessions'
import type { LiveSessionScenePublicationDto } from '@artificer-toolkit/schema/api/liveSessionState'
import {
  sceneFogCommandResultSchema,
  type SceneFogPatchInput,
  type SceneFogPublishCommandInput
} from '@artificer-toolkit/schema/api/sceneFog'
import {
  sceneStoredFogCommandSchema,
  sceneStoredLiveCommandSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { sceneStoredFogSaveSchema } from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import {
  sceneCommandResultDtoSchema,
  type CampaignSceneStateDto,
  type SceneCommandResultDto,
  type SceneLiveCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { applySceneDelta, type SceneFogChunk } from '@artificer-toolkit/shared/vtt'
import type { RoomTransaction } from './roomEncounterStore.js'
import { ROOM_SCENE_DEFINITION_ENTITY } from './roomSceneDefinition.js'
import { readRoomScene, readRoomSceneHeader } from './roomSceneRead.js'
import { readRoomSceneRow, writeRoomSceneRow } from './roomSceneRecords.js'

/** A Scene edit the room refuses with a user-safe code; the Scene is unchanged. */
export class RoomSceneCommandRefusal extends Error {
  constructor(
    readonly code: LiveSessionCommandRejectionCodeDto,
    message: string
  ) {
    super(message)
    this.name = 'RoomSceneCommandRefusal'
  }
}

/** The room's view of a committed (or replayed) Scene edit, before vision composition. */
export interface RoomSceneEdit {
  result: SceneCommandResultDto
  scene: CampaignSceneStateDto
  header: ReturnType<typeof readRoomSceneHeader>
  /** The edit changes fog visibility, so every member is resynchronized. */
  fogChanged: boolean
}

/** One Scene edit the room commits inside its journaled transaction, on the uncomposed Scene. */
export type RoomSceneEditWork = (base: {
  transaction: RoomTransaction
  scene: CampaignSceneStateDto
  presentation: LiveSessionScenePublicationDto['presentation']
}) => RoomSceneEdit | Promise<RoomSceneEdit>

/** A complete fog patch the GM staged over the socket, ready for its journaled publication. */
export interface StagedSceneFogUpload {
  saveId: string
  input: SceneFogPatchInput
  inputChecksum: string
  expiresAt: number
  chunks: SceneFogChunk[]
}

type FogPatchReceipt = ReturnType<typeof sceneStoredFogCommandSchema.parse>

const REFUSAL_CODES = {
  FORBIDDEN: 'FORBIDDEN',
  STALE: 'STALE_STATE',
  INVALID: 'INVALID_COMMAND'
} as const satisfies Record<string, LiveSessionCommandRejectionCodeDto>

/**
 * Commits one inline Scene command (settings, lights, darkness, annotations, measurements) into the
 * room's Scene rows: the live head, the changed entity and the INLINE receipt Convex checkpoints.
 */
export function publishRoomSceneInline(input: {
  transaction: RoomTransaction
  scene: CampaignSceneStateDto
  actor: { role: 'OWNER' | 'PLAYER'; userId: string }
  command: SceneLiveCommandInputDto
}): RoomSceneEdit {
  const { transaction, scene } = input
  const { header, live } = readRoomScene(transaction, input.command.sceneId.toLowerCase())
  assertScenePins(scene, header)
  const plan = planSceneInlineCommand({
    input: input.command,
    header,
    live,
    actor: input.actor,
    readCommand: (commandId) =>
      readRoomSceneRow(transaction, 'sceneLiveCommands', [header.id, commandId]),
    readLiveEntity: (collection, entityId) =>
      readRoomSceneRow(transaction, 'sceneLiveEntities', [header.id, collection, entityId]),
    readDefinitionEntity: (collection, entityId) => {
      const matches = transaction.records(ROOM_SCENE_DEFINITION_ENTITY).filter((record) => {
        const key: unknown = JSON.parse(record.key)
        return (
          Array.isArray(key) &&
          key[0] === header.definitionSaveId &&
          key[1] === collection &&
          key[3] === entityId
        )
      })
      if (matches.length > 1) throw new Error('Room Scene definition entity is inconsistent.')
      return matches[0] ? JSON.parse(matches[0].json) : null
    }
  })
  if (plan.kind === 'REPLAY') return { result: plan.result, scene, header, fogChanged: false }
  if (plan.kind !== 'COMMIT')
    throw new RoomSceneCommandRefusal(REFUSAL_CODES[plan.kind], plan.message)
  if (plan.change) writeRoomSceneRow(transaction, 'sceneLiveEntities', plan.change)
  writeRoomSceneRow(transaction, 'sceneLiveStates', plan.state)
  writeRoomSceneRow(transaction, 'sceneLiveCommands', plan.receipt)
  if (!plan.result.delta) throw new Error('Inline Scene command result has no delta.')
  return {
    result: plan.result,
    scene: applySceneDelta(scene, plan.result.delta, plan.result.version),
    header: readRoomSceneHeader(transaction, header.id),
    fogChanged: plan.result.delta.kind === 'FOG_MODE_SET'
  }
}

/** The FOG_PATCH receipt a GM's earlier publication of this command left, if any. */
export function readRoomSceneFogReceipt(
  transaction: RoomTransaction,
  sceneId: string,
  commandId: string
): FogPatchReceipt | null {
  const value = readRoomSceneRow(transaction, 'sceneLiveCommands', [
    sceneId.toLowerCase(),
    commandId.toLowerCase()
  ])
  if (!value) return null
  const stored = sceneStoredLiveCommandSchema.parse(value)
  if (stored.encoding !== 'FOG_PATCH')
    throw new RoomSceneCommandRefusal(
      'INVALID_COMMAND',
      'Command ID was already used with different input.'
    )
  const receipt = sceneStoredFogCommandSchema.parse(stored)
  if (
    receipt.inputChecksum !== checksumCanonicalJson(receipt.input) ||
    receipt.resultChecksum !== checksumCanonicalJson(receipt.result) ||
    receipt.result.commandId !== receipt.commandId ||
    receipt.result.sceneId !== receipt.sceneId ||
    receipt.result.replayed
  )
    throw new Error('Stored Scene fog command is inconsistent.')
  return receipt
}

/**
 * Publishes a GM's complete staged fog patch (D79): the PUBLISHED save, its chunks, the merged
 * layer, the live head and the FOG_PATCH receipt are written as Scene rows in the caller's
 * transaction. The live result patches the uploaded chunks into the owner's layer.
 */
export function publishRoomSceneFog(input: {
  transaction: RoomTransaction
  scene: CampaignSceneStateDto
  actorUserId: string
  command: SceneFogPublishCommandInput
  readUpload: () => StagedSceneFogUpload
}): RoomSceneEdit {
  const { transaction, scene, actorUserId } = input
  const command = {
    ...input.command,
    sceneId: input.command.sceneId.toLowerCase(),
    commandId: input.command.commandId.toLowerCase(),
    saveId: input.command.saveId.toLowerCase()
  }
  const { header, live } = readRoomScene(transaction, command.sceneId)
  assertScenePins(scene, header)
  const prior = readRoomSceneFogReceipt(transaction, header.id, command.commandId)
  if (prior) {
    if (
      prior.actorUserId !== actorUserId ||
      prior.result.patch.saveId !== command.saveId ||
      prior.input.expectedSceneVersion !== command.expectedSceneVersion
    )
      throw new RoomSceneCommandRefusal(
        'INVALID_COMMAND',
        'Command ID was already used with different input.'
      )
    if (prior.result.version > header.version)
      throw new Error('Stored Scene fog command is inconsistent.')
    return {
      result: liveFogResult(
        prior.result,
        fogPatchDelta(
          prior.input.layer,
          readPublishedChunks(transaction, header.id, command.saveId)
        ),
        true
      ),
      scene,
      header,
      fogChanged: false
    }
  }
  const upload = input.readUpload()
  if (
    upload.saveId !== command.saveId ||
    upload.input.sceneId !== command.sceneId ||
    upload.input.commandId !== command.commandId ||
    upload.input.expectedSceneVersion !== command.expectedSceneVersion
  )
    throw new RoomSceneCommandRefusal(
      'INVALID_COMMAND',
      'Scene fog save does not match this command.'
    )
  if (header.fogMode === 'OFF')
    throw new RoomSceneCommandRefusal('INVALID_COMMAND', 'Fog of war is off for this Scene.')
  if (command.expectedSceneVersion > header.version)
    throw new RoomSceneCommandRefusal(
      'STALE_STATE',
      'Scene version is ahead of the authoritative state.'
    )
  const existingRow = readRoomSceneRow(transaction, 'sceneFogLayers', [
    header.id,
    upload.input.layer.ownerUserId
  ])
  const existing = existingRow ? parseSceneFogLayer(existingRow, header.version) : null
  if (existing && existing.version > command.expectedSceneVersion)
    throw new RoomSceneCommandRefusal(
      'STALE_STATE',
      'Scene fog layer changed before this command completed.'
    )
  if (
    existing &&
    (existing.width !== upload.input.layer.width || existing.height !== upload.input.layer.height)
  )
    throw new RoomSceneCommandRefusal(
      'INVALID_COMMAND',
      'Scene fog layer dimensions cannot change.'
    )
  const state = advanceLiveState(header, live)
  const save = sceneStoredFogSaveSchema.parse({
    id: upload.saveId,
    sceneId: header.id,
    commandId: command.commandId,
    actorUserId,
    input: upload.input,
    inputChecksum: upload.inputChecksum,
    status: 'PUBLISHED',
    receivedChunks: upload.input.chunkManifest.length,
    expiresAt: upload.expiresAt,
    chunksRemoved: false
  })
  const { layer, patch } = planSceneFogPublication(save, header, state, existing)
  const result = sceneFogCommandResultSchema.parse({
    sceneId: header.id,
    commandId: command.commandId,
    version: state.version,
    occurrence: null,
    replayed: false,
    patch
  })
  writeRoomSceneRow(transaction, 'sceneFogSaves', save)
  for (const [ordinal, chunk] of upload.chunks.entries())
    writeRoomSceneRow(transaction, 'sceneFogChunks', {
      saveId: save.id,
      ordinal,
      chunk,
      checksum: checksumCanonicalJson(chunk)
    })
  writeRoomSceneRow(transaction, 'sceneFogLayers', layer)
  writeRoomSceneRow(transaction, 'sceneLiveStates', state)
  writeRoomSceneRow(
    transaction,
    'sceneLiveCommands',
    sceneStoredFogCommandSchema.parse({
      encoding: 'FOG_PATCH',
      sceneId: header.id,
      commandId: command.commandId,
      actorUserId,
      input: upload.input,
      inputChecksum: upload.inputChecksum,
      result,
      resultChecksum: checksumCanonicalJson(result)
    })
  )
  const delta = fogPatchDelta(upload.input.layer, upload.chunks)
  return {
    result: liveFogResult(result, delta, false),
    scene: applySceneDelta(scene, delta, result.version),
    header: readRoomSceneHeader(transaction, header.id),
    fogChanged: true
  }
}

/** The uploaded chunks merged by index into the owner's layer, as Convex merges a manual patch. */
function fogPatchDelta(
  layer: { ownerUserId: string | null; width: number; height: number },
  chunks: SceneFogChunk[]
) {
  return {
    kind: 'FOG_CHUNKS_PATCHED',
    layer: { ownerUserId: layer.ownerUserId, width: layer.width, height: layer.height, chunks }
  } as const
}

function liveFogResult(
  result: ReturnType<typeof sceneFogCommandResultSchema.parse>,
  delta: ReturnType<typeof fogPatchDelta>,
  replayed: boolean
): SceneCommandResultDto {
  return sceneCommandResultDtoSchema.parse({
    sceneId: result.sceneId,
    commandId: result.commandId,
    version: result.version,
    occurrence: null,
    replayed,
    delta
  })
}

function readPublishedChunks(
  transaction: RoomTransaction,
  sceneId: string,
  saveId: string
): SceneFogChunk[] {
  const saveRow = readRoomSceneRow(transaction, 'sceneFogSaves', [saveId])
  const save = sceneStoredFogSaveSchema.parse(saveRow)
  return save.input.chunkManifest.map((manifest, ordinal) =>
    parseSceneReferencedFogChunk(
      saveRow,
      readRoomSceneRow(transaction, 'sceneFogChunks', [saveId, ordinal]),
      { ...manifest, saveId, ordinal },
      sceneId,
      save.input.layer
    )
  )
}

function assertScenePins(
  scene: CampaignSceneStateDto,
  header: ReturnType<typeof readRoomSceneHeader>
): void {
  if (
    scene.id !== header.id ||
    scene.campaignId !== header.campaignId ||
    scene.version !== header.version ||
    scene.definitionId !== header.definitionId ||
    scene.definitionVersion !== header.definitionVersion
  )
    throw new Error('Room Scene source pins are stale.')
}
