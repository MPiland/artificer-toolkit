import { afterEach, describe, expect, it } from 'vitest'
import {
  sceneLiveStateHeaderSchema,
  type SceneLiveStateHeader
} from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  campaignSceneStateDtoSchema,
  sceneFogChunkDtoSchema,
  sceneFogLayerDtoSchema,
  type CampaignSceneStateDto,
  type SceneCommandResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { SceneUndoExecuteInput } from '@artificer-toolkit/schema/api/sceneUndo'
import {
  liveSessionCheckpointSceneKeys,
  type LiveSessionCheckpointSceneTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import { sceneFogPatchInputSchema } from '@artificer-toolkit/schema/api/sceneFog'
import { LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES } from '@artificer-toolkit/schema/api/liveSessionCheckpointJournal'
import {
  sceneStoredLiveStateSchema,
  sceneStoredUndoCommandSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import {
  sceneStoredFogChunkSchema,
  sceneStoredFogSaveSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import {
  parseGeometryCommand,
  parseGeometrySave
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import {
  parseSceneFogLayer,
  parseSceneReferencedFogChunk
} from '@artificer-toolkit/encounter-persistence/sceneFogDocuments'
import { planSceneFogPublication } from '@artificer-toolkit/encounter-persistence/sceneFogPublication'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { canonicalJsonRecordSchema } from '@artificer-toolkit/schema/shared/jsonDelta'
import { applySceneDelta } from '@artificer-toolkit/shared/vtt'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import { encounterSceneBindingSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { applyRoomSummonTokens } from './roomActionSummonTokens.js'
import { buildRoomCheckpointRecords } from './roomCheckpointRecords.js'
import { RoomEncounterStore, SCENE_EVIDENCE_ROW, type RoomRecord } from './roomEncounterStore.js'
import {
  persistRoomSceneCommand,
  persistRoomSceneTokenCreate
} from './roomSceneCommandPersistence.js'
import { ROOM_SCENE_DEFINITION_HEADER } from './roomSceneDefinition.js'
import { readRoomSceneRow, writeRoomSceneRow } from './roomSceneRecords.js'
import { publishRoomSceneUndo } from './roomSceneUndo.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { uuid } from './testing/roomAggregateFixture.js'

type Input = Parameters<typeof persistRoomSceneCommand>[0]
const sceneId = uuid(1)
const tokenId = uuid(2)
const doorId = uuid(3)
const databases: ReturnType<typeof createNodeSqliteRoomStorage>['database'][] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

function row(table: LiveSessionCheckpointSceneTable, value: Record<string, unknown>): RoomRecord {
  return {
    kind: 'SCENE_CHECKPOINT_ROW',
    revision: null,
    key: canonicalizeJson([
      table,
      ...liveSessionCheckpointSceneKeys[table].map((field) => value[field])
    ]),
    json: canonicalizeJson(value)
  }
}

function fixture(overrides = true) {
  const { storage, database } = createNodeSqliteRoomStorage()
  databases.push(database)
  const counts = {
    annotations: 0,
    barriers: 1,
    darknessZones: 0,
    lights: 0,
    tokens: 1
  }
  const header: SceneLiveStateHeader = {
    id: sceneId,
    campaignId: uuid(4),
    definitionId: uuid(5),
    definitionSaveId: uuid(6),
    definitionVersion: 2,
    name: 'Room Scene',
    ambientIllumination: 'BRIGHT',
    daylight: false,
    fogMode: 'OFF',
    visionRevealMode: 'ON_DRAG',
    grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
    map: { assetId: uuid(7), width: 1000, height: 1000, tileManifestAssetId: null },
    version: 1,
    fogLayerCount: 0,
    counts,
    currentCounts: { ...counts, measurements: 0 }
  }
  const token = {
    id: tokenId,
    assetId: null,
    controlledByUserIds: [],
    height: 1,
    width: 1,
    hidden: false,
    locked: false,
    label: 'Token',
    rotationDegrees: 0,
    position: { x: 0, y: 0 },
    senses: [],
    vision: null
  }
  const barrier = {
    id: doorId,
    kind: 'DOOR' as const,
    a: { x: 20, y: 0 },
    b: { x: 20, y: 20 },
    blocksLightWhenClosed: true,
    blocksMovementWhenClosed: true,
    initialState: 'CLOSED' as const,
    openAngleDegrees: 90
  }
  const {
    counts: _counts,
    currentCounts: _currentCounts,
    definitionSaveId: _save,
    fogLayerCount: _fogCount,
    ...sceneHeader
  } = header
  const scene = campaignSceneStateDtoSchema.parse({
    ...sceneHeader,
    annotations: [],
    barriers: [barrier],
    darknessZones: [],
    lights: [],
    tokens: [token],
    measurements: [],
    fogLayers: [],
    doorStates: { [doorId]: 'CLOSED' }
  })
  const head = sceneStoredLiveStateSchema.parse({
    sceneId,
    version: 1,
    fogLayerCount: 0,
    nextFogOrdinal: 8,
    counts: { ...counts, measurements: 0 },
    nextOrdinals: { ...counts, measurements: 0, tokens: 7, barriers: 9 },
    settings: {
      ambientIllumination: { value: 'BRIGHT', daylight: false, version: 1 },
      fogMode: { value: 'OFF', version: 1 },
      visionRevealMode: { value: 'ON_DRAG', version: 0 }
    }
  })
  const entity = (collection: 'tokens' | 'barriers') => {
    const value =
      collection === 'tokens' ? { collection, entity: token } : { collection, entity: barrier }
    const fields = {
      sceneId,
      collection,
      entityId: collection === 'tokens' ? tokenId : doorId,
      value,
      ordinal: collection === 'tokens' ? 3 : 5,
      version: 1,
      doorState: collection === 'tokens' ? null : 'CLOSED'
    }
    return row('sceneLiveEntities', { ...fields, checksum: checksumCanonicalJson(fields) })
  }
  const room = new RoomEncounterStore(storage)
  room.hydrate({
    epoch: uuid(8),
    documents: [],
    records: [
      {
        kind: ROOM_SCENE_DEFINITION_HEADER,
        key: sceneId,
        revision: null,
        json: canonicalizeJson(sceneLiveStateHeaderSchema.parse(header))
      },
      {
        kind: 'SCENE_CHECKPOINT_SOURCE',
        key: sceneId,
        revision: null,
        json: canonicalizeJson({
          sceneId,
          definitionSaveId: header.definitionSaveId,
          definitionVersion: 2,
          presentationVersion: 4
        })
      },
      row('sceneLiveStates', head),
      ...(overrides ? [entity('tokens'), entity('barriers')] : [])
    ]
  })
  const read = (
    table: LiveSessionCheckpointSceneTable | 'sceneLiveCommands' | 'sceneGeometrySaves',
    key: unknown[]
  ) => {
    const kind =
      table === 'sceneLiveCommands' || table === 'sceneGeometrySaves'
        ? SCENE_EVIDENCE_ROW
        : 'SCENE_CHECKPOINT_ROW'
    const retained = room.record(kind, canonicalizeJson([table, ...key]))
    if (!retained) throw new Error('Missing fixture row.')
    return canonicalJsonRecordSchema.parse(JSON.parse(retained.json))
  }
  const input = {
    header,
    scene,
    baseOrdinals: {
      tokens: [{ tokenId, baseOrdinal: 0 }],
      barriers: [{ barrierId: doorId, baseOrdinal: 0 }]
    },
    command: {
      type: 'MOVE_SCENE_TOKEN' as const,
      sceneId,
      commandId: uuid(10),
      expectedSceneVersion: 1,
      expectedEncounterVersion: null,
      correlationId: null,
      movementKind: 'VOLUNTARY' as const,
      tokenId,
      path: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ]
    },
    actorUserId: uuid(9),
    presentationVersion: 4,
    saveId: uuid(11),
    now: 1_800_000_000_000,
    result: {
      commandId: uuid(10),
      sceneId,
      version: 2,
      replayed: false,
      occurrence: null,
      delta: { kind: 'TOKEN_MOVED' as const, tokenId, position: { x: 10, y: 0 } }
    }
  } satisfies Omit<Input, 'transaction'>
  const commit = (value: Omit<Input, 'transaction'>) =>
    room.transact(async (transaction) => persistRoomSceneCommand({ ...value, transaction }))
  // The room commits undo through Scene history beside these native move and door rows.
  const undo = (undoScene: CampaignSceneStateDto, command: SceneUndoExecuteInput['input']) =>
    room.transact(async (transaction) => {
      const { result } = await publishRoomSceneUndo({
        transaction,
        userId: input.actorUserId,
        scene: undoScene,
        request: { input: command, presentation: { expectedPresentationVersion: 4 } },
        settledEncounterMechanics: async () => false
      })
      const state = sceneStoredLiveStateSchema.parse(
        readRoomSceneRow(transaction, 'sceneLiveStates', [sceneId])
      )
      return { result, state }
    })
  return { room, input, read, commit, undo, head, storage }
}

describe('room Scene command persistence', () => {
  it('commits native move and door rows that pack with a Scene-history undo into one checkpoint', async () => {
    const base = fixture()
    const snapshot = base.room.checkpointSnapshot()
    const moved = await base.commit(base.input)
    expect(moved).toEqual({ ...base.head, version: 2 })
    const move = parseGeometryCommand(base.read('sceneLiveCommands', [sceneId, uuid(10)]), 2)
    const save = parseGeometrySave(base.read('sceneGeometrySaves', [uuid(11)]))
    expect(save).toMatchObject({
      status: 'PUBLISHED',
      snapshotVersion: 1,
      fogSaves: [],
      expiresAt: base.input.now + 86_400_000
    })
    expect(move.result.fogPatches).toEqual([])
    expect(base.read('sceneLiveEntities', [sceneId, 'tokens', tokenId])).toMatchObject({
      ordinal: 3,
      version: 2,
      value: { entity: { position: { x: 10, y: 0 }, vision: null } }
    })
    const movedScene = applySceneDelta(
      base.input.scene,
      base.input.result.delta!,
      base.input.result.version
    )
    const doorCommand: Input['command'] = {
      type: 'SET_SCENE_DOOR_STATE',
      sceneId,
      commandId: uuid(12),
      expectedSceneVersion: 2,
      barrierId: doorId,
      state: 'OPEN'
    }
    const doorResult: SceneCommandResultDto = {
      commandId: uuid(12),
      sceneId,
      version: 3,
      replayed: false,
      occurrence: null,
      delta: { kind: 'DOOR_STATE_SET', barrierId: doorId, state: 'OPEN' }
    }
    const opened = await base.commit({
      ...base.input,
      header: { ...base.input.header, version: 2 },
      scene: movedScene,
      command: doorCommand,
      result: doorResult,
      saveId: uuid(13)
    })
    expect(opened).toEqual({ ...base.head, version: 3 })
    expect(base.read('sceneLiveEntities', [sceneId, 'barriers', doorId])).toMatchObject({
      ordinal: 5,
      doorState: 'OPEN',
      version: 3
    })
    const undoResult: SceneCommandResultDto = {
      commandId: uuid(14),
      sceneId,
      version: 4,
      replayed: false,
      occurrence: null,
      delta: {
        kind: 'TOKEN_MOVE_UNDONE',
        tokenId,
        position: { x: 0, y: 0 },
        undoneCommandId: uuid(10)
      }
    }
    const undone = await base.undo(
      applySceneDelta(movedScene, doorResult.delta!, doorResult.version),
      {
        type: 'UNDO_LAST_SCENE_MOVE',
        sceneId,
        commandId: uuid(14),
        expectedSceneVersion: 3
      }
    )
    expect(undone).toEqual({ result: undoResult, state: { ...base.head, version: 4 } })
    const receipt = sceneStoredUndoCommandSchema.parse(
      base.read('sceneLiveCommands', [sceneId, uuid(14)])
    )
    expect(receipt.undoneCommandId).toBe(uuid(10))
    expect(receipt.result.restoredFogOwners).toEqual([])
    expect(base.read('sceneLiveEntities', [sceneId, 'tokens', tokenId])).toMatchObject({
      ordinal: 3,
      version: 4,
      value: { entity: { position: { x: 0, y: 0 }, vision: null } }
    })
    const entries = base.room.committedWriteSets({
      epoch: snapshot.epoch,
      fromSequence: snapshot.sequence,
      fromChecksum: snapshot.checksum,
      toSequence: base.room.sequence,
      maxEntries: 10,
      maxBytes: LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES
    }).entries
    const checkpoint = buildRoomCheckpointRecords({
      documents: snapshot.documents,
      records: snapshot.records,
      fromSequence: snapshot.sequence,
      fromChecksum: snapshot.checksum,
      entries
    })
    expect(checkpoint.scenes).toHaveLength(1)
    expect(checkpoint.scenes[0]).toMatchObject({ sceneId, fromVersion: 1, toVersion: 4 })
    // Saves and receipts stay in the room (ADR 0035 Amendment 26): two saves and three receipts.
    expect(base.room.records(SCENE_EVIDENCE_ROW)).toHaveLength(5)
    expect(checkpoint.scenes[0]?.changes.map(({ table }) => table)).not.toContain(
      'sceneLiveCommands'
    )
  })

  it('uses the immutable base ordinal when no override exists', async () => {
    const base = fixture(false)
    await base.commit(base.input)
    expect(base.read('sceneLiveEntities', [sceneId, 'tokens', tokenId]).ordinal).toBe(0)
  })

  it('restores retained fog on native undo and rolls back all writes for corrupt chunk metadata', async () => {
    const base = fixture()
    const ownerUserId = uuid(30)
    const originalChunk = sceneFogChunkDtoSchema.parse({
      data: 'AA==',
      width: 1,
      height: 1,
      index: 0,
      x: 0,
      y: 0
    })
    const revealedChunk = sceneFogChunkDtoSchema.parse({ ...originalChunk, data: 'AQ==' })
    const originalInput = sceneFogPatchInputSchema.parse({
      type: 'PATCH_SCENE_FOG',
      sceneId,
      commandId: uuid(31),
      expectedSceneVersion: 0,
      layer: { ownerUserId, width: 1, height: 1 },
      chunkManifest: [{ index: 0, checksum: checksumCanonicalJson(originalChunk) }]
    })
    const originalSave = sceneStoredFogSaveSchema.parse({
      id: uuid(31),
      sceneId,
      commandId: uuid(31),
      actorUserId: base.input.actorUserId,
      input: originalInput,
      inputChecksum: checksumCanonicalJson(originalInput),
      status: 'PUBLISHED',
      receivedChunks: 1,
      expiresAt: base.input.now + 86_400_000,
      chunksRemoved: false,
      previousLayer: null
    })
    const originalStoredChunk = sceneStoredFogChunkSchema.parse({
      saveId: originalSave.id,
      ordinal: 0,
      chunk: originalChunk,
      checksum: checksumCanonicalJson(originalChunk)
    })
    const originalHead = sceneStoredLiveStateSchema.parse({
      ...base.head,
      settings: { ...base.head.settings, fogMode: { value: 'PER_PLAYER', version: 1 } }
    })
    const originalPublication = planSceneFogPublication(
      originalSave,
      base.input.header,
      originalHead,
      null
    )
    await base.room.transact(async (transaction) => {
      writeRoomSceneRow(transaction, 'sceneFogSaves', originalSave)
      writeRoomSceneRow(transaction, 'sceneFogChunks', originalStoredChunk)
      writeRoomSceneRow(transaction, 'sceneFogLayers', originalPublication.layer)
      writeRoomSceneRow(transaction, 'sceneLiveStates', originalHead)
    })
    const originalLayer = sceneFogLayerDtoSchema.parse({
      ...originalInput.layer,
      chunks: [originalChunk]
    })
    const moveInput: Omit<Input, 'transaction'> = {
      ...base.input,
      header: { ...base.input.header, fogMode: 'PER_PLAYER', fogLayerCount: 1 },
      scene: { ...base.input.scene, fogMode: 'PER_PLAYER', fogLayers: [originalLayer] }
    }
    // Seed the move's paired, published fog evidence in the same real SQLite transaction.
    const moved = await base.room.transact(async (transaction) => {
      const head = persistRoomSceneCommand({ ...moveInput, transaction })
      const parentRow = readRoomSceneRow(transaction, 'sceneGeometrySaves', [moveInput.saveId])
      const commandRow = readRoomSceneRow(transaction, 'sceneLiveCommands', [sceneId, uuid(10)])
      if (!parentRow || !commandRow) throw new Error('Missing published move fixture.')
      const parent = parseGeometrySave(parentRow)
      const command = parseGeometryCommand(commandRow, 2)
      const childInput = sceneFogPatchInputSchema.parse({
        type: 'PATCH_SCENE_FOG',
        sceneId,
        commandId: uuid(32),
        expectedSceneVersion: parent.snapshotVersion,
        layer: originalInput.layer,
        chunkManifest: [{ index: 0, checksum: checksumCanonicalJson(revealedChunk) }]
      })
      const child = sceneStoredFogSaveSchema.parse({
        id: uuid(32),
        sceneId,
        commandId: uuid(32),
        actorUserId: parent.actorUserId,
        geometrySaveId: parent.id,
        input: childInput,
        inputChecksum: checksumCanonicalJson(childInput),
        status: 'PUBLISHED',
        receivedChunks: 1,
        expiresAt: parent.expiresAt,
        chunksRemoved: false
      })
      const publication = planSceneFogPublication(
        child,
        moveInput.header,
        head,
        originalPublication.layer
      )
      writeRoomSceneRow(transaction, 'sceneFogSaves', {
        ...child,
        previousLayer: publication.previousLayer
      })
      writeRoomSceneRow(
        transaction,
        'sceneFogChunks',
        sceneStoredFogChunkSchema.parse({
          saveId: child.id,
          ordinal: 0,
          chunk: revealedChunk,
          checksum: checksumCanonicalJson(revealedChunk)
        })
      )
      writeRoomSceneRow(transaction, 'sceneFogLayers', publication.layer)
      writeRoomSceneRow(transaction, 'sceneGeometrySaves', {
        ...parent,
        fogSaves: [{ saveId: child.id, ownerUserId }]
      })
      const result = {
        ...command.result,
        fogPatches: [{ mode: 'REPLACE' as const, ...publication.patch }]
      }
      writeRoomSceneRow(
        transaction,
        'sceneLiveCommands',
        parseGeometryCommand(
          {
            ...command,
            result,
            resultChecksum: checksumCanonicalJson(result)
          },
          2
        )
      )
      return head
    })
    const undoScene = {
      ...applySceneDelta(moveInput.scene, moveInput.result.delta!, 2),
      fogLayers: [sceneFogLayerDtoSchema.parse({ ...originalInput.layer, chunks: [revealedChunk] })]
    }
    const undoCommand = {
      type: 'UNDO_LAST_SCENE_MOVE' as const,
      sceneId,
      commandId: uuid(33),
      expectedSceneVersion: 2
    }
    await base.room.transact(async (transaction) => {
      writeRoomSceneRow(transaction, 'sceneFogChunks', {
        ...originalStoredChunk,
        checksum: checksumCanonicalJson('corrupt retained chunk metadata')
      })
    })
    const before = {
      sequence: base.room.sequence,
      checksum: base.room.checksum,
      records: base.room.records('SCENE_CHECKPOINT_ROW'),
      evidence: base.room.records(SCENE_EVIDENCE_ROW)
    }
    // Restored chunk validation runs after the undo stages its layer, token, head and receipt.
    await expect(base.undo(undoScene, undoCommand)).rejects.toThrow('fog chunk is inconsistent')
    const recovered = new RoomEncounterStore(base.storage)
    expect({
      sequence: recovered.sequence,
      checksum: recovered.checksum,
      records: recovered.records('SCENE_CHECKPOINT_ROW'),
      evidence: recovered.records(SCENE_EVIDENCE_ROW)
    }).toEqual(before)
    expect(
      recovered.record(
        SCENE_EVIDENCE_ROW,
        canonicalizeJson(['sceneLiveCommands', sceneId, uuid(33)])
      )
    ).toBeNull()
    await base.room.transact(async (transaction) => {
      writeRoomSceneRow(transaction, 'sceneFogChunks', originalStoredChunk)
    })
    const beforeUndo = base.room.sequence
    const undone = await base.undo(undoScene, undoCommand)
    expect(base.room.sequence).toBe(beforeUndo + 1)
    expect(undone.state).toEqual({ ...moved, version: 3 })
    expect(undone.state).toMatchObject({ fogLayerCount: 1, nextFogOrdinal: 9 })
    expect(undone.result).toMatchObject({
      version: 3,
      delta: { kind: 'TOKEN_MOVE_UNDONE', position: { x: 0, y: 0 }, undoneCommandId: uuid(10) }
    })
    const restored = parseSceneFogLayer(base.read('sceneFogLayers', [sceneId, ownerUserId]), 3)
    expect(restored).toMatchObject({
      ownerUserId,
      ordinal: 8,
      version: 3,
      chunks: originalPublication.layer.chunks
    })
    expect(
      parseSceneReferencedFogChunk(
        base.read('sceneFogSaves', [originalSave.id]),
        base.read('sceneFogChunks', [originalSave.id, 0]),
        restored.chunks[0]!,
        sceneId,
        restored
      )
    ).toEqual(originalChunk)
    expect(base.read('sceneFogChunks', [uuid(32), 0])).toMatchObject({
      chunk: revealedChunk,
      checksum: checksumCanonicalJson(revealedChunk)
    })
    const receipt = sceneStoredUndoCommandSchema.parse(
      base.read('sceneLiveCommands', [sceneId, uuid(33)])
    )
    expect(receipt.result.restoredFogOwners).toEqual([ownerUserId])
    expect(receipt.resultChecksum).toBe(checksumCanonicalJson(receipt.result))
    expect(receipt.undoneCommandId).toBe(uuid(10))
    expect(base.read('sceneLiveEntities', [sceneId, 'tokens', tokenId])).toMatchObject({
      ordinal: 3,
      version: 3,
      value: { entity: { position: { x: 0, y: 0 }, vision: null } }
    })
    // A retried undo replays its stored receipt without another write set.
    const replay = await base.undo({ ...undoScene, version: 3 }, undoCommand)
    expect(replay.result).toEqual({ ...undone.result, replayed: true })
    expect(base.room.sequence).toBe(beforeUndo + 1)
  })

  it('rejects stale source/head/result pins and unavailable ordinals without committing writes', async () => {
    const base = fixture(false)
    const variants: Omit<Input, 'transaction'>[] = [
      { ...base.input, presentationVersion: 5 },
      { ...base.input, header: { ...base.input.header, definitionSaveId: uuid(50) } },
      {
        ...base.input,
        header: { ...base.input.header, version: 2 },
        scene: { ...base.input.scene, version: 2 }
      },
      { ...base.input, result: { ...base.input.result, version: 3 } },
      { ...base.input, baseOrdinals: { tokens: [{ tokenId, baseOrdinal: null }], barriers: [] } }
    ]
    for (const input of variants) await expect(base.commit(input)).rejects.toThrow()
    expect(base.room.sequence).toBe(0)
  })

  it('rejects composed vision against a stored raw override and preserves append-only receipts and saves', async () => {
    const base = fixture()
    await expect(
      base.commit({
        ...base.input,
        scene: {
          ...base.input.scene,
          tokens: [
            {
              ...base.input.scene.tokens[0]!,
              vision: {
                angleDegrees: 360,
                brightRange: 30,
                dimRange: 60,
                directionDegrees: 0,
                enabled: true
              }
            }
          ]
        }
      })
    ).rejects.toThrow('raw override')
    await base.commit(base.input)
    const advanced = {
      ...base.input,
      header: { ...base.input.header, version: 2 },
      scene: applySceneDelta(base.input.scene, base.input.result.delta!, base.input.result.version),
      command: {
        ...base.input.command,
        expectedSceneVersion: 2,
        path: [
          { x: 10, y: 0 },
          { x: 20, y: 0 }
        ]
      },
      result: {
        ...base.input.result,
        version: 3,
        delta: { kind: 'TOKEN_MOVED' as const, tokenId, position: { x: 20, y: 0 } }
      }
    }
    await expect(base.commit(advanced)).rejects.toThrow('command ID')
    await expect(
      base.commit({
        ...advanced,
        command: { ...advanced.command, commandId: uuid(40) },
        result: { ...advanced.result, commandId: uuid(40) }
      })
    ).rejects.toThrow('save ID')
    expect(base.room.sequence).toBe(1)
  })

  describe('a token an action conjures', () => {
    const summonId = uuid(50)
    const origin = { encounterId: uuid(51), commandId: uuid(52) }
    const create = (base: ReturnType<typeof fixture>, token: object = {}) =>
      base.room.transact(async (transaction) =>
        persistRoomSceneTokenCreate({
          transaction,
          header: base.input.header,
          scene: base.input.scene,
          token: { ...base.input.scene.tokens[0]!, id: summonId, label: 'Summon', ...token },
          commandId: uuid(53),
          actorUserId: base.input.actorUserId,
          presentationVersion: 4,
          saveId: uuid(54),
          now: base.input.now,
          actionOrigin: origin
        })
      )

    it('is a new live token whose command names the action as its origin', async () => {
      const base = fixture()
      const created = await create(base)
      expect(created).toMatchObject({
        version: 2,
        counts: { tokens: 2 },
        nextOrdinals: { tokens: 8 }
      })
      expect(base.read('sceneLiveEntities', [sceneId, 'tokens', summonId])).toMatchObject({
        ordinal: 7,
        version: 2,
        value: { entity: { label: 'Summon', vision: null } }
      })
      expect(
        parseGeometryCommand(base.read('sceneLiveCommands', [sceneId, uuid(53)]), 2)
      ).toMatchObject({ actionOrigin: origin })
    })

    it('is placed on the Encounter Scene and bound to its actor in the cast transaction', async () => {
      const base = fixture()
      const memory = createMemoryEncounterStore({ idPrefix: 'summon' })
      const encounterId = uuid(51)
      await memory.store.insert(
        'encounterSceneBindings',
        encounterSceneBindingSchema.parse({
          encounterId,
          campaignId: uuid(4),
          sceneId,
          commandId: uuid(55),
          commandFingerprint: checksumCanonicalJson({ commandId: uuid(55) }),
          createdAt: '2026-10-23T00:00:00.000Z'
        })
      )
      const actorId = uuid(56)
      const created = await base.room.transact(async (transaction) =>
        applyRoomSummonTokens({
          ctx: { db: memory.store },
          transaction,
          userId: base.input.actorUserId,
          summon: {
            state: { id: encounterId },
            commandId: origin.commandId,
            summons: [
              { actorId, token: { ...base.input.scene.tokens[0]!, id: summonId, label: 'Summon' } }
            ]
          }
        })
      )
      expect(created).toEqual([
        { sceneId, sceneCommandId: expect.any(String), tokenId: summonId, actorId }
      ])
      expect(
        parseGeometryCommand(
          base.read('sceneLiveCommands', [sceneId, created[0]!.sceneCommandId]),
          2
        )
      ).toMatchObject({ actionOrigin: origin })
      expect(
        await memory.store
          .query('encounterActorTokenBindings')
          .withIndex('by_encounterId_actorId', (q) =>
            q.eq('encounterId', encounterId).eq('actorId', actorId)
          )
          .unique()
      ).toMatchObject({ sceneId, tokenId: summonId })
    })

    it('refuses an ID already on the Scene and a token that carries vision', async () => {
      const base = fixture()
      await expect(create(base, { id: tokenId })).rejects.toThrow('already in use')
      await expect(
        create(base, {
          vision: {
            brightRange: 30,
            dimRange: 60,
            angleDegrees: 360,
            directionDegrees: 0,
            enabled: true
          }
        })
      ).rejects.toThrow('cannot carry vision')
      expect(base.room.sequence).toBe(0)
    })
  })
})
