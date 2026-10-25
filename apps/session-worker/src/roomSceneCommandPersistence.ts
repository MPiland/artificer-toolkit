import { liveSessionCheckpointSceneSourceSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  sceneGeometryCommandResultSchema,
  type SceneBaseOrdinals,
  type SceneNativeGeometryCommandInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import {
  sceneCommandResultDtoSchema,
  sceneStoredTokenDtoSchema,
  sceneTokenFacingCommandInputDtoSchema,
  type CampaignSceneStateDto,
  type SceneTokenFacingCommandInputDto,
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
import {
  parseGeometryCommand,
  parseGeometrySave
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { applySceneGeometryDelta, type SceneToken } from '@artificer-toolkit/shared/vtt'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { RoomTransaction } from './roomEncounterStore.js'
import { liveSessionSceneGeometryCommandInputSchema } from './nativeRoomSceneCommand.js'
import { readRoomSceneRow, writeRoomSceneRow } from './roomSceneRecords.js'

/**
 * Stages native checkpoint records for an approved standalone move or door plan, or an Encounter
 * action's facing change; the caller owns the outer commit. Undo commits through `publishRoomSceneUndo`.
 */
export function persistRoomSceneCommand(args: {
  transaction: RoomTransaction
  header: SceneLiveStateHeader
  /** Current native entities before Character vision composition. */
  scene: CampaignSceneStateDto
  baseOrdinals: SceneBaseOrdinals
  command:
    | ReturnType<typeof liveSessionSceneGeometryCommandInputSchema.parse>
    | SceneTokenFacingCommandInputDto
  actorUserId: string
  result: SceneCommandResultDto
  presentationVersion: number
  /** The fresh geometry save this command publishes. */
  saveId: string
  now: number
  /** The Encounter action whose forced movement this move settles (D139); omitted for a user's move. */
  actionOrigin?: { encounterId: string; commandId: string }
}) {
  const { transaction, header, scene } = args
  const supplied =
    args.command.type === 'SET_SCENE_TOKEN_FACING'
      ? sceneTokenFacingCommandInputDtoSchema.parse(args.command)
      : liveSessionSceneGeometryCommandInputSchema.parse(args.command)
  const { state, result } = beginDirectSceneCommand({ ...args, supplied })
  const input = normalizeGeometryInput(supplied)
  if (
    input.type !== 'MOVE_SCENE_TOKEN' &&
    input.type !== 'SET_SCENE_DOOR_STATE' &&
    input.type !== 'SET_SCENE_TOKEN_FACING'
  )
    throw new Error('Room Scene command is unsupported.')
  if (input.type === 'SET_SCENE_TOKEN_FACING' && !args.actionOrigin)
    throw new Error("Only an Encounter action changes a token's facing.")
  if (input.type === 'MOVE_SCENE_TOKEN' && input.expectedEncounterVersion !== null)
    throw new Error('Room Scene persistence requires a standalone move.')
  const target = geometryTarget(input)
  if (canonicalizeJson(result.delta) !== canonicalizeJson(target.delta))
    throw new Error('Room Scene command result is inconsistent.')
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
  const change = liveEntityChange({
    sceneId: header.id,
    collection: target.collection,
    entityId: target.entityId,
    value,
    doorState:
      value.collection === 'barriers' ? (reduced.doorStates[value.entity.id] ?? null) : null,
    ordinal,
    version: state.version
  })
  return writeDirectSceneCommand({
    transaction,
    header,
    state,
    input,
    change,
    result,
    saveId: args.saveId,
    actorUserId: args.actorUserId,
    now: args.now,
    actionOrigin: args.actionOrigin,
    priorRotationDegrees:
      input.type === 'SET_SCENE_TOKEN_FACING' && rawValue.collection === 'tokens'
        ? rawValue.entity.rotationDegrees
        : undefined
  })
}

/**
 * Stages the Scene rows that put a new token on the map for an Encounter action (a summon): the
 * token is a fresh live entity, so it takes the next token ordinal. Like a forced move it derives no
 * fog, which a token without vision needs none of; the caller owns the outer commit and recomposes
 * vision afterwards. The command names the action as its origin, so only the action's undo reaches it.
 */
export function persistRoomSceneTokenCreate(args: {
  transaction: RoomTransaction
  header: SceneLiveStateHeader
  scene: CampaignSceneStateDto
  token: SceneToken
  commandId: string
  actorUserId: string
  presentationVersion: number
  saveId: string
  now: number
  actionOrigin: { encounterId: string; commandId: string }
}) {
  const { transaction, header, scene } = args
  const token = sceneStoredTokenDtoSchema.parse(args.token)
  if (token.vision !== null)
    throw new Error('A token a direct Scene command creates cannot carry vision.')
  const supplied = {
    type: 'UPSERT_SCENE_TOKEN' as const,
    commandId: args.commandId,
    sceneId: header.id,
    expectedSceneVersion: header.version,
    token
  }
  const input = normalizeGeometryInput(supplied)
  const target = geometryTarget(input)
  const result = sceneCommandResultDtoSchema.parse({
    commandId: input.commandId,
    delta: target.delta,
    occurrence: null,
    replayed: false,
    sceneId: header.id,
    version: header.version + 1
  })
  const { state } = beginDirectSceneCommand({ ...args, supplied, result })
  if (
    scene.tokens.some(({ id }) => id.toLowerCase() === target.entityId) ||
    readRoomSceneRow(transaction, 'sceneLiveEntities', [header.id, 'tokens', target.entityId])
  )
    throw new Error('Scene token ID is already in use.')
  const ordinal = state.nextOrdinals.tokens++
  state.counts.tokens += 1
  const change = liveEntityChange({
    sceneId: header.id,
    collection: 'tokens',
    entityId: target.entityId,
    value: normalizeSceneGeometryEntity({ collection: 'tokens', entity: token }),
    doorState: null,
    ordinal,
    version: state.version
  })
  return writeDirectSceneCommand({ ...args, input, change, result, state })
}

/**
 * Stages the Scene rows that take a token off the map for an Encounter action (a summon that ends
 * or is reverted): the entity becomes a tombstone and the token count falls. Like the create it
 * derives no fog, and its command names the ending Encounter command as its origin.
 */
export function persistRoomSceneTokenRemove(args: {
  transaction: RoomTransaction
  header: SceneLiveStateHeader
  scene: CampaignSceneStateDto
  tokenId: string
  commandId: string
  actorUserId: string
  presentationVersion: number
  saveId: string
  now: number
  actionOrigin: { encounterId: string; commandId: string }
}) {
  const { header, scene } = args
  const supplied = {
    type: 'REMOVE_SCENE_TOKEN' as const,
    commandId: args.commandId,
    sceneId: header.id,
    expectedSceneVersion: header.version,
    tokenId: args.tokenId
  }
  const input = normalizeGeometryInput(supplied)
  const target = geometryTarget(input)
  const result = sceneCommandResultDtoSchema.parse({
    commandId: input.commandId,
    delta: target.delta,
    occurrence: null,
    replayed: false,
    sceneId: header.id,
    version: header.version + 1
  })
  const { state } = beginDirectSceneCommand({ ...args, supplied, result })
  if (!scene.tokens.some(({ id }) => id.toLowerCase() === target.entityId))
    throw new Error('Scene token is unavailable.')
  state.counts.tokens -= 1
  const change = liveEntityChange({
    sceneId: header.id,
    collection: 'tokens',
    entityId: target.entityId,
    value: null,
    doorState: null,
    ordinal: null,
    version: state.version
  })
  return writeDirectSceneCommand({ ...args, input, change, result, state })
}

type LiveEntity = ReturnType<typeof sceneStoredLiveEntitySchema.parse>

function liveEntityChange(row: Omit<LiveEntity, 'checksum'>): LiveEntity {
  return sceneStoredLiveEntitySchema.parse({ ...row, checksum: checksumCanonicalJson(row) })
}

/**
 * The Scene source pins, versions and unused IDs every direct Scene command needs before it writes;
 * returns the live state it advances.
 */
function beginDirectSceneCommand(args: {
  transaction: RoomTransaction
  header: SceneLiveStateHeader
  scene: CampaignSceneStateDto
  presentationVersion: number
  saveId: string
  supplied: { sceneId: string; commandId: string; expectedSceneVersion: number }
  result: SceneCommandResultDto
}) {
  const { transaction, header, scene, supplied } = args
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
  if (readRoomSceneRow(transaction, 'sceneGeometrySaves', [args.saveId]))
    throw new Error('Scene geometry save ID was already used.')
  return { state: advanceLiveState(header, live), result }
}

/** Writes a direct command's save, changed entity, live head and receipt together. */
function writeDirectSceneCommand(args: {
  transaction: RoomTransaction
  header: SceneLiveStateHeader
  state: ReturnType<typeof advanceLiveState>
  input: SceneNativeGeometryCommandInput
  change: LiveEntity
  result: SceneCommandResultDto
  saveId: string
  actorUserId: string
  now: number
  actionOrigin: { encounterId: string; commandId: string } | undefined
  priorRotationDegrees?: number
}) {
  const { transaction, header, state, input, change, result } = args
  // Direct commands never derive fog (`isStagedSceneCommand`); fog-deriving ones stage and publish
  // through `publishSceneGeometry`, which stores the real patches that undo reads.
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
    resultChecksum: checksumCanonicalJson(retainedResult),
    actionOrigin: args.actionOrigin ?? null,
    ...(args.priorRotationDegrees !== undefined && {
      priorRotationDegrees: args.priorRotationDegrees
    })
  })
  parseGeometrySave(save)
  parseGeometryCommand(receipt, state.version)
  writeRoomSceneRow(transaction, 'sceneGeometrySaves', save)
  writeRoomSceneRow(transaction, 'sceneLiveEntities', change)
  writeRoomSceneRow(transaction, 'sceneLiveStates', state)
  writeRoomSceneRow(transaction, 'sceneLiveCommands', receipt)
  return state
}
