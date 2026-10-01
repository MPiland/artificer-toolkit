import { liveSessionCheckpointSceneSourceSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  sceneGeometryCommandResultSchema,
  type SceneBaseOrdinals
} from '@artificer-toolkit/schema/api/sceneGeometry'
import {
  sceneCommandResultDtoSchema,
  type CampaignSceneStateDto,
  type SceneCommandResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneStoredLiveEntitySchema,
  sceneStoredLiveStateSchema,
  sceneStoredGeometryCommandSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { sceneStoredGeometrySaveSchema } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import { advanceLiveState } from '@artificer-toolkit/encounter-persistence/sceneLiveState'
import {
  geometryTarget,
  normalizeGeometryInput,
  normalizeSceneGeometryEntity
} from '@artificer-toolkit/encounter-persistence/sceneGeometryValues'
import { parseGeometrySave } from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { applySceneGeometryDelta } from '@artificer-toolkit/shared/vtt'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { RoomTransaction } from './roomEncounterStore.js'
import { liveSessionSceneCommandInputSchema } from './nativeRoomSceneCommand.js'
import { readRoomSceneRow, writeRoomSceneRow } from './roomSceneRecords.js'
import { publishRoomSceneUndo } from './roomSceneUndo.js'

/** Stages native checkpoint records for an approved fast plan; the caller owns the outer commit. */
export async function persistRoomSceneCommand(args: {
  transaction: RoomTransaction
  header: SceneLiveStateHeader
  /** Current native entities before Character vision composition. */
  scene: CampaignSceneStateDto
  baseOrdinals: SceneBaseOrdinals
  command: ReturnType<typeof liveSessionSceneCommandInputSchema.parse>
  actorUserId: string
  result: SceneCommandResultDto
  presentationVersion: number
  /** A fresh save for MOVE/DOOR; the retained target's parent save for UNDO. */
  saveId: string
  now: number
}) {
  const { transaction, header, scene } = args
  const supplied = liveSessionSceneCommandInputSchema.parse(args.command)
  const result = sceneCommandResultDtoSchema.parse(args.result)
  const sourceRecord = transaction.record('SCENE_CHECKPOINT_SOURCE', header.id)
  if (!sourceRecord) throw new Error('Room Scene source is unavailable.')
  const source = liveSessionCheckpointSceneSourceSchema.parse(JSON.parse(sourceRecord.json))
  if (
    source.sceneId !== header.id ||
    source.definitionSaveId !== header.definitionSaveId ||
    source.definitionVersion !== header.definitionVersion ||
    source.presentationVersion !== args.presentationVersion ||
    scene.id !== header.id ||
    scene.campaignId !== header.campaignId ||
    scene.definitionId !== header.definitionId ||
    scene.definitionVersion !== header.definitionVersion ||
    scene.version !== header.version
  )
    throw new Error('Room Scene source pins are stale.')
  const rawHead = readRoomSceneRow(transaction, 'sceneLiveStates', [header.id])
  const live = rawHead ? sceneStoredLiveStateSchema.parse(rawHead) : null
  if ((live?.version ?? 0) !== header.version || (live && live.sceneId !== header.id))
    throw new Error('Room Scene version is stale.')
  if (
    supplied.sceneId.toLowerCase() !== header.id ||
    supplied.expectedSceneVersion !== header.version ||
    result.sceneId !== header.id ||
    result.commandId !== supplied.commandId.toLowerCase() ||
    result.version !== header.version + 1 ||
    result.replayed ||
    result.occurrence !== null
  )
    throw new Error('Room Scene command result is inconsistent.')
  if (readRoomSceneRow(transaction, 'sceneLiveCommands', [header.id, result.commandId]))
    throw new Error('Scene command ID was already used.')
  if (supplied.type === 'UNDO_LAST_SCENE_MOVE') {
    if (result.delta?.kind !== 'TOKEN_MOVE_UNDONE')
      throw new Error('Room Scene undo result is inconsistent.')
    const parentRow = readRoomSceneRow(transaction, 'sceneGeometrySaves', [args.saveId])
    if (!parentRow) throw new Error('Stored Scene undo evidence is unavailable.')
    const parent = parseGeometrySave(parentRow)
    if (parent.sceneId !== header.id || parent.commandId !== result.delta.undoneCommandId)
      throw new Error('Stored Scene undo evidence is unavailable.')
    const undo = await publishRoomSceneUndo({
      transaction,
      scene,
      userId: args.actorUserId,
      request: {
        input: supplied,
        presentation: { expectedPresentationVersion: args.presentationVersion }
      },
      targetCommandId: result.delta.undoneCommandId
    })
    if (checksumCanonicalJson(undo.result) !== checksumCanonicalJson(result))
      throw new Error('Room Scene undo result is inconsistent.')
    return sceneStoredLiveStateSchema.parse(
      readRoomSceneRow(transaction, 'sceneLiveStates', [header.id])
    )
  }
  const state = advanceLiveState(header, live)
  const input = normalizeGeometryInput(supplied)
  if (input.type !== 'MOVE_SCENE_TOKEN' && input.type !== 'SET_SCENE_DOOR_STATE')
    throw new Error('Room Scene command is unsupported.')
  if (input.type === 'MOVE_SCENE_TOKEN' && input.expectedEncounterVersion !== null)
    throw new Error('Room Scene persistence requires a standalone move.')
  const target = geometryTarget(input)
  if (canonicalizeJson(result.delta) !== canonicalizeJson(target.delta))
    throw new Error('Room Scene command result is inconsistent.')
  if (readRoomSceneRow(transaction, 'sceneGeometrySaves', [args.saveId]))
    throw new Error('Scene geometry save ID was already used.')
  const overrideRow = readRoomSceneRow(transaction, 'sceneLiveEntities', [
    header.id,
    target.collection,
    target.entityId
  ])
  const override = overrideRow ? sceneStoredLiveEntitySchema.parse(overrideRow) : null
  const token = scene.tokens.find((entity) => entity.id.toLowerCase() === target.entityId)
  const barrier = scene.barriers.find((entity) => entity.id.toLowerCase() === target.entityId)
  const rawValue =
    target.collection === 'tokens'
      ? token && normalizeSceneGeometryEntity({ collection: 'tokens', entity: token })
      : barrier && normalizeSceneGeometryEntity({ collection: 'barriers', entity: barrier })
  if (!rawValue) throw new Error('Room Scene target is unavailable.')
  if (override) {
    const { checksum, ...content } = override
    if (
      checksumCanonicalJson(content) !== checksum ||
      override.version > header.version ||
      override.sceneId !== header.id ||
      override.entityId !== target.entityId ||
      override.collection !== target.collection ||
      override.value === null ||
      canonicalizeJson(override.value) !== canonicalizeJson(rawValue)
    )
      throw new Error('Room Scene target does not match its raw override.')
  }
  const ordinal = override
    ? override.ordinal
    : target.collection === 'tokens'
      ? args.baseOrdinals.tokens.find((entry) => entry.tokenId.toLowerCase() === target.entityId)
          ?.baseOrdinal
      : args.baseOrdinals.barriers.find(
          (entry) => entry.barrierId.toLowerCase() === target.entityId
        )?.baseOrdinal
  if (ordinal === null || ordinal === undefined || !Number.isSafeInteger(ordinal) || ordinal < 0)
    throw new Error('Room Scene target ordinal is unavailable.')
  const doorState =
    rawValue.collection === 'barriers' && rawValue.entity.kind === 'DOOR'
      ? scene.doorStates[rawValue.entity.id]
      : null
  if (
    rawValue.collection === 'barriers' &&
    (rawValue.entity.kind !== 'DOOR' ||
      !doorState ||
      (override && override.doorState !== doorState))
  )
    throw new Error('Room Scene door is inconsistent.')
  const reduced = applySceneGeometryDelta(
    {
      tokens: rawValue.collection === 'tokens' ? [rawValue.entity] : [],
      barriers: rawValue.collection === 'barriers' ? [rawValue.entity] : [],
      doorStates: doorState ? { [rawValue.entity.id]: doorState } : {}
    },
    target.delta
  )
  const value =
    rawValue.collection === 'tokens'
      ? normalizeSceneGeometryEntity({ collection: 'tokens', entity: reduced.tokens[0]! })
      : normalizeSceneGeometryEntity({ collection: 'barriers', entity: reduced.barriers[0]! })
  const fields = {
    sceneId: header.id,
    collection: target.collection,
    entityId: target.entityId,
    value,
    doorState:
      value.collection === 'barriers' ? (reduced.doorStates[value.entity.id] ?? null) : null,
    ordinal,
    version: state.version
  }
  const change = sceneStoredLiveEntitySchema.parse({
    ...fields,
    checksum: checksumCanonicalJson(fields)
  })
  const retainedResult = sceneGeometryCommandResultSchema.parse({ ...result, fogPatches: [] })
  const inputChecksum = checksumCanonicalJson(input)
  const save = sceneStoredGeometrySaveSchema.parse({
    id: args.saveId,
    sceneId: header.id,
    commandId: input.commandId,
    actorUserId: args.actorUserId,
    input,
    inputChecksum,
    snapshotVersion: header.version,
    status: 'PUBLISHED',
    expiresAt: args.now + 24 * 60 * 60 * 1000,
    fogSaves: []
  })
  const receipt = sceneStoredGeometryCommandSchema.parse({
    encoding: 'GEOMETRY',
    sceneId: header.id,
    commandId: input.commandId,
    actorUserId: args.actorUserId,
    input,
    inputChecksum,
    result: retainedResult,
    resultChecksum: checksumCanonicalJson(retainedResult)
  })
  parseGeometrySave(save)
  parseGeometryCommand(receipt, state.version)
  writeRoomSceneRow(transaction, 'sceneGeometrySaves', save)
  writeRoomSceneRow(transaction, 'sceneLiveEntities', change)
  writeRoomSceneRow(transaction, 'sceneLiveStates', state)
  writeRoomSceneRow(transaction, 'sceneLiveCommands', receipt)
  return state
}
