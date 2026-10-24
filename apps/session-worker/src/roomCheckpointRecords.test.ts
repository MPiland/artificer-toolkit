import { describe, expect, it } from 'vitest'
import { applyJsonDelta } from '@artificer-toolkit/encounter-persistence/jsonDelta'
import {
  LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES,
  type LiveSessionCheckpointJournalEntry
} from '@artificer-toolkit/schema/api/liveSessionCheckpointJournal'
import {
  liveSessionCheckpointSceneKeys,
  type LiveSessionCheckpointSceneTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import { canonicalJsonRecordSchema } from '@artificer-toolkit/schema/shared/jsonDelta'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import { buildRoomCheckpointRecords } from './roomCheckpointRecords.js'
import {
  RoomEncounterStore,
  SCENE_EVIDENCE_ROW,
  type RoomDocument,
  type RoomRecord
} from './roomEncounterStore.js'
import { aggregate, encounterId, uuid } from './testing/roomAggregateFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'

const baseChecksum = sha256Hex('base')
const timestamp = '2026-09-01T00:00:00.000Z'
const actor = (): RoomDocument => ({
  table: 'encounterRunActors',
  id: 'private:actor',
  creationTime: 1,
  fields: {
    id: uuid(0x100),
    encounterId,
    stateJson: JSON.stringify({
      hp: 10,
      effects: [],
      padding: 'x'.repeat(20_000)
    }),
    stateChecksum: sha256Hex('actor'),
    snapshotChecksum: sha256Hex('snapshot'),
    formOriginSnapshotChecksum: null,
    sourceFactsChecksum: null
  }
})
const receipt = (ordinal: number): RoomDocument => ({
  table: 'characterCommandReceipts',
  id: `private:receipt:${ordinal}`,
  creationTime: ordinal,
  fields: {
    id: uuid(0x200 + ordinal),
    characterId: uuid(3),
    commandId: uuid(0x300 + ordinal),
    actorId: uuid(4),
    commandFingerprint: sha256Hex('command'),
    occurredAt: timestamp,
    historyJson: JSON.stringify({ ordinal }),
    historyChecksum: sha256Hex('history')
  }
})
const movement = (round: number): RoomDocument => ({
  table: 'encounterTurnMovements',
  id: `private:movement:${round}`,
  creationTime: round,
  fields: {
    encounterId,
    round,
    turnActorId: uuid(0x100),
    actorId: uuid(0x100),
    usedFeet: 5,
    speedBonuses: 0,
    speedId: null
  }
})
const characterPlay = (): RoomDocument => ({
  table: 'characterPlayStates',
  id: 'private:play',
  creationTime: 1,
  fields: {
    characterId: uuid(3),
    userId: uuid(4),
    streamVersion: 7,
    maximumHitPoints: 10,
    speeds: [{ speedId: uuid(5), amount: 30, unit: 'FEET' }],
    state: {
      hitpoints: { current: 10, temp: 0, hitDice: [], deathSaves: NO_DEATH_SAVES },
      equipped: [],
      attuned: [],
      resourceUsage: [],
      itemUsage: [],
      itemDegradation: [],
      partyVisibility: { sheet: false, health: 'HIDDEN' }
    },
    checksum: sha256Hex('play'),
    updatedAt: timestamp
  }
})
const insert = (document: RoomDocument) => ({ op: 'INSERT', ...document })
const restore = (document: RoomDocument) => ({ op: 'RESTORE', ...document })
const patch = (id: string, fields: Record<string, unknown>, remove: string[] = []) => ({
  op: 'PATCH',
  id,
  fields,
  remove
})
function journal(writeSets: readonly unknown[][], fromSequence = 0, fromChecksum = baseChecksum) {
  let chain = fromChecksum
  return writeSets.map((writes, index): LiveSessionCheckpointJournalEntry => {
    const writeSetJson = JSON.stringify(writes)
    const writeSetChecksum = sha256Hex(writeSetJson)
    chain = sha256Hex(`${chain}:${writeSetChecksum}`)
    return {
      sequence: fromSequence + index + 1,
      writeSetJson,
      writeSetChecksum,
      chainChecksum: chain
    }
  })
}
const build = (
  documents: readonly RoomDocument[],
  writes: readonly unknown[][],
  records: readonly RoomRecord[] = []
) =>
  buildRoomCheckpointRecords({
    documents,
    records,
    fromSequence: 0,
    fromChecksum: baseChecksum,
    entries: journal(writes)
  })

const sceneId = uuid(0x500)
const sceneSource = (): RoomRecord => ({
  kind: 'SCENE_CHECKPOINT_SOURCE',
  key: sceneId,
  revision: null,
  json: canonicalizeJson({
    sceneId,
    definitionSaveId: uuid(0x501),
    definitionVersion: 2,
    presentationVersion: 3
  })
})
const sceneRow = (
  table: LiveSessionCheckpointSceneTable,
  value: Record<string, unknown>
): RoomRecord => ({
  kind: 'SCENE_CHECKPOINT_ROW',
  key: canonicalizeJson([
    table,
    ...liveSessionCheckpointSceneKeys[table].map((field) => value[field])
  ]),
  revision: null,
  json: canonicalizeJson(value)
})
const sceneHead = (version: number) =>
  sceneRow('sceneLiveStates', {
    sceneId,
    version,
    fogLayerCount: 0,
    nextFogOrdinal: 0,
    settings: {
      ambientIllumination: { value: 'BRIGHT', daylight: false, version: 0 },
      visionRevealMode: { value: 'ON_DRAG', version: 0 },
      fogMode: { value: 'OFF', version: 0 }
    },
    counts: {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens: 1,
      measurements: 0
    },
    nextOrdinals: {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens: 1,
      measurements: 0
    }
  })
const sceneToken = (version: number, x: number) =>
  sceneRow('sceneLiveEntities', {
    sceneId,
    collection: 'tokens',
    entityId: uuid(0x502),
    value: {
      collection: 'tokens',
      entity: {
        id: uuid(0x502),
        assetId: null,
        controlledByUserIds: [],
        label: 'Token',
        height: 5,
        width: 5,
        hidden: false,
        locked: false,
        rotationDegrees: 0,
        position: { x, y: 0 },
        senses: [],
        vision: null
      }
    },
    ordinal: 0,
    version,
    checksum: sha256Hex(`token:${x}`)
  })
const setRecord = (record: RoomRecord) => ({ op: 'RECORD_SET', record })
function fogRecords(): RoomRecord[] {
  const saveId = uuid(0x503)
  const chunk = { data: 'AA==', width: 1, height: 1, index: 0, x: 0, y: 0 }
  const checksum = checksumCanonicalJson(chunk)
  return [
    sceneRow('sceneFogSaves', {
      id: saveId,
      sceneId,
      commandId: uuid(0x504),
      actorUserId: uuid(4),
      input: {
        type: 'PATCH_SCENE_FOG',
        sceneId,
        commandId: uuid(0x504),
        expectedSceneVersion: 1,
        layer: { ownerUserId: null, width: 1, height: 1 },
        chunkManifest: [{ index: 0, checksum }]
      },
      inputChecksum: sha256Hex('fog'),
      status: 'PUBLISHED',
      receivedChunks: 1,
      expiresAt: 1,
      chunksRemoved: false
    }),
    sceneRow('sceneFogChunks', { saveId, ordinal: 0, chunk, checksum }),
    sceneRow('sceneFogLayers', {
      sceneId,
      ownerUserId: null,
      width: 1,
      height: 1,
      ordinal: 0,
      version: 2,
      chunks: [{ index: 0, saveId, ordinal: 0, checksum }],
      checksum: sha256Hex('layer')
    })
  ]
}

describe('room checkpoint Scene records', () => {
  it('keeps Scene command evidence in the room: it never reaches a checkpoint', () => {
    const evidence = {
      kind: SCENE_EVIDENCE_ROW,
      key: canonicalizeJson(['sceneLiveCommands', sceneId, uuid(0x510)]),
      revision: String(Date.now()),
      json: canonicalizeJson({ sceneId, commandId: uuid(0x510) })
    }
    expect(build([], [[setRecord(evidence)]], [sceneSource()]).scenes).toEqual([])
  })

  it('rejects evidence updates and deletions, including reuse within the same checkpoint', () => {
    const save = fogRecords()[0]!
    const updated = { ...save, json: canonicalizeJson({ ...JSON.parse(save.json), expiresAt: 2 }) }
    const deletion = { op: 'RECORD_DELETE', kind: save.kind, key: save.key }
    for (const write of [setRecord(updated), deletion]) {
      expect(() => build([], [[write]], [sceneSource(), save])).toThrow('append-only')
      expect(() => build([], [[setRecord(save)], [write]], [sceneSource()])).toThrow('append-only')
    }
  })

  it('folds multiple committed commands into one token and live-head delta', () => {
    const baseline = [sceneSource(), sceneHead(1), sceneToken(1, 0)]
    const result = build(
      [],
      [
        [setRecord(sceneToken(2, 5)), setRecord(sceneHead(2))],
        [setRecord(sceneToken(3, 10)), setRecord(sceneHead(3))]
      ],
      baseline
    )
    expect(result.changes).toEqual([])
    expect(result.history).toEqual([])
    expect(result.scenes).toHaveLength(1)
    const scene = result.scenes[0]!
    expect(scene).toMatchObject({
      ...JSON.parse(sceneSource().json),
      fromVersion: 1,
      toVersion: 3
    })
    expect(scene.changes).toHaveLength(2)
    const token = scene.changes.find(({ table }) => table === 'sceneLiveEntities')!
    expect(token.key).toEqual([sceneId, 'tokens', uuid(0x502)])
    expect(token.previousChecksum).toBe(checksumCanonicalJson(JSON.parse(sceneToken(1, 0).json)))
    expect(token.nextChecksum).toBe(checksumCanonicalJson(JSON.parse(sceneToken(3, 10).json)))
    expect(applyJsonDelta(JSON.parse(sceneToken(1, 0).json), token.delta!)).toEqual(
      JSON.parse(sceneToken(3, 10).json)
    )
  })

  it('retains fog saves, chunks and layers together, including a null public owner key', () => {
    const rows = fogRecords()
    const result = build(
      [],
      [[...rows.slice().reverse().map(setRecord), setRecord(sceneHead(2))]],
      [sceneSource(), sceneHead(1)]
    )
    const scene = result.scenes[0]!
    expect(scene.changes.map(({ table }) => table)).toEqual([
      'sceneFogChunks',
      'sceneFogLayers',
      'sceneFogSaves',
      'sceneLiveStates'
    ])
    expect(scene.changes.find(({ table }) => table === 'sceneFogLayers')!.key).toEqual([
      sceneId,
      null
    ])
    for (const row of rows) {
      const change = scene.changes.find(({ table }) => table === JSON.parse(row.key)[0])!
      expect(change).toMatchObject({
        previousChecksum: null,
        delta: { set: JSON.parse(row.json) }
      })
    }
  })

  it('uses an existing fog save to scope new chunks and starts an absent live head at zero', () => {
    const [save, chunk] = fogRecords()
    const result = build([], [[setRecord(chunk!), setRecord(sceneHead(1))]], [sceneSource(), save!])
    expect(result.scenes[0]).toMatchObject({ fromVersion: 0, toVersion: 1 })
    expect(result.scenes[0]!.changes.map(({ table }) => table)).toEqual([
      'sceneFogChunks',
      'sceneLiveStates'
    ])
  })

  it('omits unchanged Scenes, equal source writes and rows restored to their baseline', () => {
    const baseline = [sceneSource(), sceneHead(1), sceneToken(1, 0)]
    expect(build([], [], baseline).scenes).toEqual([])
    expect(
      build(
        [],
        [[setRecord(sceneSource()), setRecord(sceneToken(2, 5))], [setRecord(sceneToken(1, 0))]],
        baseline
      ).scenes
    ).toEqual([])
  })

  it('folds Scene row deletions by public key and omits inserted then deleted rows', () => {
    const token = sceneToken(1, 0)
    const deletion = { op: 'RECORD_DELETE', kind: token.kind, key: token.key }
    const result = build(
      [],
      [[deletion, setRecord(sceneHead(2))]],
      [sceneSource(), sceneHead(1), token]
    )
    expect(
      result.scenes[0]!.changes.find(({ table }) => table === 'sceneLiveEntities')
    ).toMatchObject({
      previousChecksum: checksumCanonicalJson(JSON.parse(token.json)),
      nextChecksum: null,
      delta: null
    })
    expect(build([], [[setRecord(token), deletion]], [sceneSource()]).scenes).toEqual([])
  })

  it('rejects source pin mutation, deletion and duplicate baseline identities', () => {
    const source = sceneSource()
    for (const field of ['definitionSaveId', 'definitionVersion', 'presentationVersion']) {
      const value = JSON.parse(source.json) as Record<string, unknown>
      value[field] = field === 'definitionSaveId' ? uuid(0x509) : 4
      expect(() =>
        build([], [[setRecord({ ...source, json: canonicalizeJson(value) })]], [source])
      ).toThrow('source pins')
    }
    expect(() =>
      build([], [[{ op: 'RECORD_DELETE', kind: source.kind, key: source.key }]], [source])
    ).toThrow('cannot be deleted')
    expect(() => build([], [], [source, source])).toThrow('source pins')
    expect(() => build([], [], [source, sceneHead(1), sceneHead(1)])).toThrow('public key')
  })

  it('rejects reserved kind, key, revision, canonical JSON and complete-row violations a page touches', () => {
    const row = sceneHead(1)
    for (const invalid of [
      { ...row, kind: 'SCENE_CHECKPOINT_UNKNOWN' },
      { ...row, key: canonicalizeJson(['sceneLiveStates', uuid(0x509)]) },
      { ...row, key: '["unknown"]' },
      { ...row, revision: '1' },
      { ...row, json: JSON.stringify(JSON.parse(row.json), null, 2) },
      { ...row, json: canonicalizeJson({ sceneId, version: 1 }) },
      { ...sceneSource(), key: uuid(0x509) }
    ])
      expect(() =>
        build(
          [],
          [[{ op: 'RECORD_DELETE', kind: invalid.kind, key: invalid.key }]],
          [sceneSource(), invalid]
        )
      ).toThrow()
  })

  it('rejects changed Scene scope, nested foreign scope, missing pins and missing fog saves', () => {
    const [save, chunk] = fogRecords()
    const foreign = {
      ...(JSON.parse(save!.json) as Record<string, unknown>),
      sceneId: uuid(0x509)
    }
    expect(() =>
      build([], [[setRecord(sceneRow('sceneFogSaves', foreign))]], [sceneSource(), save!])
    ).toThrow('scope')
    const nestedForeign = JSON.parse(save!.json) as Record<string, unknown>
    nestedForeign.input = {
      ...(nestedForeign.input as Record<string, unknown>),
      sceneId: uuid(0x509)
    }
    expect(() =>
      build(
        [],
        [[setRecord(sceneRow('sceneFogSaves', nestedForeign)), setRecord(sceneHead(2))]],
        [sceneSource(), sceneHead(1)]
      )
    ).toThrow('scope does not match')
    expect(() => build([], [[setRecord(sceneHead(1))]])).toThrow('missing source')
    expect(() =>
      build([], [[setRecord(chunk!), setRecord(sceneHead(2))]], [sceneSource(), sceneHead(1)])
    ).toThrow('missing source or fog save')
  })

  it('rejects changed rows without an advancing live head and still verifies the journal chain', () => {
    const records = [sceneSource(), sceneHead(2), sceneToken(2, 0)]
    for (const writes of [
      [setRecord(sceneToken(3, 5))],
      [setRecord(sceneToken(3, 5)), setRecord(sceneHead(1))],
      [{ op: 'RECORD_DELETE', kind: sceneHead(2).kind, key: sceneHead(2).key }]
    ])
      expect(() => build([], [writes], records)).toThrow('live head must advance')
    const entries = journal([[setRecord(sceneHead(3))]])
    expect(() =>
      buildRoomCheckpointRecords({
        documents: [],
        records,
        fromSequence: 0,
        fromChecksum: baseChecksum,
        entries: [{ ...entries[0]!, chainChecksum: sha256Hex('wrong') }]
      })
    ).toThrow('chain checksum')
  })
})

describe('room checkpoint records', () => {
  it('rebases a changed clean input and preserves the delta when the current input is restored again', () => {
    const original = actor()
    const fetched = {
      ...original,
      fields: { ...original.fields, stateJson: '{"hp":9}', stateChecksum: sha256Hex('fetched') }
    }
    const current = { ...fetched, fields: { ...fetched.fields, stateJson: '{"hp":7}' } }
    expect(build([original], [[restore(fetched)]])).toEqual({
      changes: [],
      history: [],
      scenes: []
    })
    const result = build(
      [original],
      [
        [restore(fetched)],
        [patch(fetched.id, { stateJson: current.fields.stateJson })],
        [restore(current)]
      ]
    )
    const before = canonicalJsonRecordSchema.parse({ ...fetched.fields, stateJson: { hp: 9 } })
    const after = canonicalJsonRecordSchema.parse({ ...current.fields, stateJson: { hp: 7 } })
    expect(result.changes).toHaveLength(1)
    const change = result.changes[0]!
    expect(change.previousChecksum).toBe(checksumCanonicalJson(before))
    expect(change.nextChecksum).toBe(checksumCanonicalJson(after))
    expect(applyJsonDelta(before, change.delta!)).toEqual(after)
  })

  it.each(['checkpointed', 'command-created'] as const)(
    'refuses a changed restore over dirty %s mutable state',
    (origin) => {
      const document = actor()
      const changed = { ...document, fields: { ...document.fields, stateJson: '{"hp":7}' } }
      const documents = origin === 'checkpointed' ? [document] : []
      const writes =
        origin === 'checkpointed'
          ? [patch(document.id, { stateJson: '{"hp":9}' })]
          : [insert(document)]
      expect(() => build(documents, [writes, [restore(changed)]])).toThrow(
        'cannot replace uncheckpointed state or history'
      )
    }
  )

  it.each(['original', 'replacement'] as const)(
    'refuses restoring a deleted baseline public row with its %s native storage ID',
    (identity) => {
      const document = actor()
      const restored = {
        ...document,
        id: identity === 'original' ? document.id : 'private:replacement:actor'
      }
      expect(() =>
        build([document], [[{ op: 'DELETE', id: document.id }], [restore(restored)]])
      ).toThrow('cannot replace uncheckpointed state or history')
    }
  )

  it('restores existing history without re-emitting it and refuses changed history', () => {
    const document = receipt(1)
    const changed = {
      ...document,
      fields: { ...document.fields, historyJson: '{"ordinal":2}' }
    }
    expect(build([], [[restore(document), restore(document)]])).toEqual({
      changes: [],
      history: [],
      scenes: []
    })
    expect(() => build([document], [[restore(changed)]])).toThrow(
      'cannot replace uncheckpointed state or history'
    )
  })

  it('emits no Encounter history: only the replay index and Character receipts leave the room', () => {
    const base = {
      campaignId: uuid(2),
      encounterId,
      commandFingerprint: sha256Hex('command'),
      actorUserId: uuid(4)
    }
    const command: RoomDocument = {
      table: 'encounterRunCommands',
      id: 'room:command',
      creationTime: 1,
      fields: { ...base, commandId: uuid(0x400), createdAt: timestamp, commandType: 'CREATE' }
    }
    const ruleReceipt: RoomDocument = {
      table: 'encounterRuleReceipts',
      id: 'room:receipt',
      creationTime: 2,
      fields: {
        ...base,
        id: uuid(0x401),
        commandId: uuid(0x402),
        occurrenceId: uuid(0x403),
        commandType: 'ADVANCE_TURN',
        encounterVersion: 1,
        commandMetadataJson: '{}',
        resultJson: '{}',
        resultChecksum: sha256Hex('result'),
        correlationId: null,
        createdAt: timestamp
      }
    }
    const index: RoomDocument = {
      table: 'encounterReplayIndex',
      id: 'room:index',
      creationTime: 3,
      fields: { ...base, commandId: uuid(0x402), version: 1, rollCardId: null }
    }
    const result = build(
      [],
      [[insert(command), insert(ruleReceipt), insert(index), insert(receipt(1))]]
    )
    expect(result.history.map(({ table }) => table)).toEqual(['characterCommandReceipts'])
    expect(result.changes.map(({ table, key }) => [table, key])).toEqual([
      ['encounterReplayIndex', [uuid(2), uuid(0x402)]]
    ])
  })

  it('writes no replay index row for a Run that completes in the same save', () => {
    const index = (ordinal: number): RoomDocument => ({
      table: 'encounterReplayIndex',
      id: `room:index:${ordinal}`,
      creationTime: ordinal,
      fields: {
        campaignId: uuid(2),
        encounterId,
        commandId: uuid(0x400 + ordinal),
        commandFingerprint: sha256Hex('command'),
        actorUserId: uuid(4),
        version: ordinal,
        rollCardId: null
      }
    })
    // The Run's commands each index their replay; COMPLETE removes the whole timeline.
    const commands = [1, 2, 3].map((ordinal) => [insert(index(ordinal))])
    const complete = [1, 2, 3].map((ordinal) => ({ op: 'DELETE', id: index(ordinal).id }))
    expect(build([], [...commands, complete]).changes).toEqual([])
    // A save that ends before COMPLETE still carries the index, which the next save removes.
    expect(build([], commands).changes.map(({ table }) => table)).toEqual([
      'encounterReplayIndex',
      'encounterReplayIndex',
      'encounterReplayIndex'
    ])
  })

  it('folds repeated writes into a small decoded JSON delta with original public identities', () => {
    const document = actor()
    const original = structuredClone(document)
    const state = JSON.parse(String(document.fields.stateJson)) as Record<string, unknown>
    const next = { ...state, hp: 7, effects: [{ id: uuid(5), active: true }] }
    const result = build(
      [document],
      [
        [
          patch(document.id, {
            stateJson: JSON.stringify({ ...state, hp: 9 })
          })
        ],
        [
          patch(document.id, { stateJson: JSON.stringify(next) }),
          {
            op: 'RECORD_SET',
            record: {
              kind: 'CACHE',
              key: 'opaque',
              revision: null,
              json: 'not parsed'
            }
          }
        ]
      ]
    )
    expect(result.changes).toHaveLength(1)
    const change = result.changes[0]!
    expect(change.key).toEqual([encounterId, document.fields.id])
    const normalizedBefore = canonicalJsonRecordSchema.parse({
      ...document.fields,
      stateJson: state
    })
    const normalizedAfter = canonicalJsonRecordSchema.parse({
      ...document.fields,
      stateJson: next
    })
    expect(change.previousChecksum).toBe(checksumCanonicalJson(normalizedBefore))
    expect(change.nextChecksum).toBe(checksumCanonicalJson(normalizedAfter))
    expect(applyJsonDelta(normalizedBefore, change.delta!)).toEqual(normalizedAfter)
    expect(JSON.stringify(change.delta).length).toBeLessThan(300)
    expect(JSON.stringify(result)).not.toContain('private:')
    expect(JSON.stringify(result)).not.toContain('_creationTime')
    expect(JSON.stringify(result)).not.toContain('_id')
    expect(document).toEqual(original)
  })

  it('omits changes that return to their base, including JSON key-order and whitespace changes', () => {
    const document = actor()
    expect(
      build(
        [document],
        [
          [patch(document.id, { stateJson: '{"hp":9}' })],
          [
            {
              op: 'REPLACE',
              id: document.id,
              fields: {
                ...document.fields,
                stateJson: JSON.stringify(
                  { padding: 'x'.repeat(20_000), effects: [], hp: 10 },
                  null,
                  2
                )
              }
            }
          ]
        ]
      )
    ).toEqual({ changes: [], history: [], scenes: [] })
  })

  it('folds inserts and deletes, sorting tables and natural public identity tuples deterministically', () => {
    const old = actor()
    const fresh = {
      ...actor(),
      id: 'private:new',
      fields: { ...actor().fields, id: uuid(0x101) }
    }
    const result = build(
      [old],
      [
        [
          insert(movement(2)),
          insert(fresh),
          insert(movement(1)),
          insert(movement(3)),
          { op: 'DELETE', id: movement(3).id },
          { op: 'DELETE', id: old.id }
        ]
      ]
    )
    expect(result.changes.map(({ table, key }) => [table, key])).toEqual([
      ['encounterRunActors', [encounterId, uuid(0x100)]],
      ['encounterRunActors', [encounterId, uuid(0x101)]],
      ['encounterTurnMovements', [encounterId, 1, uuid(0x100), uuid(0x100)]],
      ['encounterTurnMovements', [encounterId, 2, uuid(0x100), uuid(0x100)]]
    ])
    expect(result.changes[0]).toMatchObject({
      nextChecksum: null,
      delta: null
    })
    expect(result.changes[1]).toMatchObject({
      previousChecksum: null,
      delta: { set: { id: uuid(0x101) } }
    })
  })

  it('compares a deleted and recreated public row against its original base', () => {
    const original = actor()
    expect(
      build(
        [original],
        [[{ op: 'DELETE', id: original.id }, insert({ ...original, id: 'new:storage:id' })]]
      )
    ).toEqual({ changes: [], history: [], scenes: [] })
  })

  it.each(['encounterRunActors', 'encounterActorSnapshots'] as const)(
    'keeps identical actor and snapshot identities in different Encounters distinct for %s',
    (table) => {
      const snapshotChecksum = 'a'.repeat(64)
      const first: RoomDocument =
        table === 'encounterRunActors'
          ? actor()
          : {
              table,
              id: 'private:snapshot',
              creationTime: 1,
              fields: {
                encounterId,
                checksum: snapshotChecksum,
                snapshotJson: '{"label":"Actor"}'
              }
            }
      const identity = table === 'encounterRunActors' ? uuid(0x100) : snapshotChecksum
      const second = {
        ...first,
        id: `${first.id}:other-encounter`,
        fields: { ...first.fields, encounterId: uuid(2) }
      }
      const result = build([], [[insert(second), insert(first)]])
      expect(result.changes.map(({ table: changedTable, key }) => [changedTable, key])).toEqual([
        [table, [encounterId, identity]],
        [table, [uuid(2), identity]]
      ])
    }
  )

  it('checkpoints Character play changes with the room play clock', () => {
    const document = characterPlay()
    const state = {
      hitpoints: { current: 7, temp: 0, hitDice: [], deathSaves: NO_DEATH_SAVES },
      equipped: [],
      attuned: [],
      resourceUsage: [],
      itemUsage: [],
      itemDegradation: [],
      partyVisibility: { sheet: false, health: 'HIDDEN' }
    }
    const result = build([document], [[patch(document.id, { streamVersion: 9, state })]])
    expect(document.fields.streamVersion).toBe(7)
    const normalizedBefore = canonicalJsonRecordSchema.parse(document.fields)
    const normalizedAfter = canonicalJsonRecordSchema.parse({
      ...document.fields,
      streamVersion: 9,
      state
    })
    expect(result.changes).toHaveLength(1)
    const change = result.changes[0]!
    expect(change.key).toEqual([uuid(3)])
    expect(change.previousChecksum).toBe(checksumCanonicalJson(normalizedBefore))
    expect(change.nextChecksum).toBe(checksumCanonicalJson(normalizedAfter))
    expect(applyJsonDelta(normalizedBefore, change.delta!)).toEqual(normalizedAfter)
  })

  it('packs immutable evidence in commit/write order, decoding JSON and hashing full rows', () => {
    const result = build(
      [receipt(0)],
      [[insert(receipt(2)), insert(receipt(1))], [insert(receipt(3))]]
    )
    expect(result.changes).toEqual([])
    expect(result.history.map((entry) => entry.key)).toEqual(
      [2, 1, 3].map((ordinal) => [uuid(3), uuid(0x300 + ordinal)])
    )
    for (const entry of result.history) {
      expect(typeof entry.value.historyJson).toBe('object')
      expect(entry.checksum).toBe(checksumCanonicalJson(entry.value))
    }
  })

  it.each(['PATCH', 'REPLACE', 'DELETE'])(
    'rejects %s of existing or newly inserted history',
    (op) => {
      const document = receipt(1)
      const write =
        op === 'DELETE'
          ? { op, id: document.id }
          : op === 'PATCH'
            ? { op, id: document.id, fields: {}, remove: [] }
            : { op, id: document.id, fields: document.fields }
      expect(() => build([document], [[write]])).toThrow('append-only')
      expect(() => build([], [[insert(document), write]])).toThrow('append-only')
    }
  )

  it.each(['PATCH', 'REPLACE'])('rejects public identity changes through %s', (op) => {
    const document = actor()
    for (const identity of [{ id: uuid(6) }, { encounterId: uuid(6) }]) {
      const fields = op === 'PATCH' ? identity : { ...document.fields, ...identity }
      const write = op === 'PATCH' ? patch(document.id, fields) : { op, id: document.id, fields }
      expect(() => build([document], [[write]])).toThrow('identity cannot change')
    }
  })

  it('rejects duplicate/missing storage IDs, duplicate public keys, and unknown tables or invalid rows a page touches', () => {
    const document = actor()
    for (const documents of [
      [document, document],
      [{ ...document, id: '' }],
      [document, { ...document, id: 'other' }],
      [{ ...document, table: 'unknown' }],
      [
        {
          ...document,
          fields: { ...document.fields, stateChecksum: 'invalid' }
        }
      ],
      [{ ...document, creationTime: NaN }]
    ])
      expect(() => build(documents, [[patch(document.id, {})]])).toThrow()
    // The base is the store's validated snapshot, so rows the page does not touch are not reread.
    expect(() => build([{ ...document, creationTime: NaN }], [])).not.toThrow()
    expect(() => build([document], [[insert(document)]])).toThrow('storage id')
    expect(() => build([document], [[insert({ ...document, id: 'other' })]])).toThrow('public key')
    expect(() => build([receipt(1)], [[insert({ ...receipt(1), id: 'other' })]])).toThrow(
      'public key'
    )
  })

  it.each(['PATCH', 'REPLACE', 'DELETE'])('rejects dangling %s writes', (op) => {
    const write =
      op === 'DELETE'
        ? { op, id: 'missing' }
        : op === 'PATCH'
          ? patch('missing', {})
          : { op, id: 'missing', fields: actor().fields }
    expect(() => build([], [[write]])).toThrow('Dangling')
  })

  it('validates PATCH field removals and REPLACE rows', () => {
    const document = actor()
    expect(() => build([document], [[patch(document.id, {}, ['stateChecksum'])]])).toThrow()
    expect(() =>
      build(
        [document],
        [
          [
            {
              op: 'REPLACE',
              id: document.id,
              fields: { id: document.fields.id }
            }
          ]
        ]
      )
    ).toThrow()
  })

  it('replays and validates excluded Character heads without emitting them', () => {
    const document: RoomDocument = {
      table: 'characters',
      id: 'private:head',
      creationTime: 1,
      fields: {
        id: uuid(3),
        userId: uuid(4),
        systemId: uuid(5),
        label: 'Character',
        status: 'ACTIVE',
        portraitAssetId: uuid(6),
        createdAt: timestamp,
        updatedAt: timestamp
      }
    }
    expect(
      build(
        [document],
        [
          [patch(document.id, { label: 'Renamed' }, ['portraitAssetId'])],
          [
            {
              op: 'REPLACE',
              id: document.id,
              fields: { ...document.fields, label: 'Replaced' }
            },
            { op: 'RECORD_DELETE', kind: 'CACHE', key: 'opaque' }
          ],
          [{ op: 'DELETE', id: document.id }]
        ]
      )
    ).toEqual({ changes: [], history: [], scenes: [] })
    expect(() => build([document], [[patch(document.id, { status: 'INVALID' })]])).toThrow()
  })

  it('rejects bad journal ranges, write-set checksums and chain checksums', () => {
    const entries = journal([[], []], 7)
    const input = {
      documents: [],
      records: [],
      fromSequence: 7,
      fromChecksum: baseChecksum,
      entries
    }
    expect(buildRoomCheckpointRecords(input)).toEqual({
      changes: [],
      history: [],
      scenes: []
    })
    for (const broken of [
      [entries[1]!],
      [entries[0]!, entries[0]!],
      [{ ...entries[0]!, writeSetChecksum: sha256Hex('wrong') }],
      [{ ...entries[0]!, chainChecksum: sha256Hex('wrong') }]
    ])
      expect(() => buildRoomCheckpointRecords({ ...input, entries: broken })).toThrow()
    for (const fromSequence of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
      expect(() => buildRoomCheckpointRecords({ ...input, fromSequence })).toThrow()
    expect(() => buildRoomCheckpointRecords({ ...input, fromChecksum: 'invalid' })).toThrow()
  })

  it('rejects malformed write sets and stored JSON even when their hashes are valid', () => {
    const document = actor()
    const writeSetJson = 'not JSON'
    const writeSetChecksum = sha256Hex(writeSetJson)
    expect(() =>
      buildRoomCheckpointRecords({
        documents: [],
        records: [],
        fromSequence: 0,
        fromChecksum: baseChecksum,
        entries: [
          {
            sequence: 1,
            writeSetJson,
            writeSetChecksum,
            chainChecksum: sha256Hex(`${baseChecksum}:${writeSetChecksum}`)
          }
        ]
      })
    ).toThrow()
    expect(() => build([], [[{ op: 'INVALID' }]])).toThrow()
    for (const stateJson of ['broken', '{"hp":1e400}']) {
      expect(() =>
        build(
          [{ ...document, fields: { ...document.fields, stateJson } }],
          [[patch(document.id, {})]]
        )
      ).toThrow()
      expect(() => build([document], [[patch(document.id, { stateJson })]])).toThrow()
    }
  })

  it('checkpoints a late restored Character play patch from its fetched base after SQLite recovery', async () => {
    const { storage, database } = createNodeSqliteRoomStorage()
    try {
      const room = new RoomEncounterStore(storage)
      room.hydrate({ epoch: uuid(9), ...aggregate(2) })
      const snapshot = room.checkpointSnapshot()
      const fetched = characterPlay()
      const nextState = {
        hitpoints: { current: 7, temp: 0, hitDice: [], deathSaves: NO_DEATH_SAVES },
        equipped: [],
        attuned: [],
        resourceUsage: [],
        itemUsage: [],
        itemDegradation: [],
        partyVisibility: { sheet: false, health: 'HIDDEN' as const }
      }
      await room.transact(async (transaction) => {
        transaction.restoreDocument(fetched)
        const row = await room.store
          .query('characterPlayStates')
          .withIndex('by_characterId', (query) => query.eq('characterId', uuid(3)))
          .unique()
        await room.store.patch(row!._id, { streamVersion: 8, state: nextState })
        transaction.restoreDocument({
          ...fetched,
          fields: { ...fetched.fields, streamVersion: 8, state: nextState }
        })
      })
      const recovered = new RoomEncounterStore(storage)
      expect(recovered.corruption).toBeNull()
      expect(recovered.documents('characterPlayStates')).toEqual(
        room.documents('characterPlayStates')
      )
      const entries = recovered.committedWriteSets({
        epoch: snapshot.epoch,
        fromSequence: snapshot.sequence,
        fromChecksum: snapshot.checksum,
        toSequence: recovered.sequence,
        maxEntries: 100,
        maxBytes: LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES
      }).entries
      expect(JSON.parse(entries[0]!.writeSetJson).map((write: { op: string }) => write.op)).toEqual(
        ['RESTORE', 'PATCH', 'RESTORE']
      )
      const result = buildRoomCheckpointRecords({
        ...snapshot,
        fromSequence: snapshot.sequence,
        fromChecksum: snapshot.checksum,
        entries
      })
      // The delta carries the room's play clock.
      expect(fetched.fields.streamVersion).toBe(7)
      const before = canonicalJsonRecordSchema.parse(fetched.fields)
      const after = canonicalJsonRecordSchema.parse({
        ...fetched.fields,
        streamVersion: 8,
        state: nextState
      })
      expect(result.changes).toHaveLength(1)
      const change = result.changes[0]!
      expect(change).toMatchObject({ table: 'characterPlayStates', key: [uuid(3)] })
      expect(change.previousChecksum).toBe(checksumCanonicalJson(before))
      expect(change.nextChecksum).toBe(checksumCanonicalJson(after))
      expect(applyJsonDelta(before, change.delta!)).toEqual(after)
      expect(result.history).toEqual([])
    } finally {
      database.close()
    }
  })

  it('folds several play commits between checkpoints into one delta that carries the room play clock', () => {
    const play = characterPlay()
    const result = build(
      [play],
      [
        [patch(play.id, { streamVersion: 8, updatedAt: '2026-01-02T00:00:00.000Z' })],
        [patch(play.id, { streamVersion: 9, updatedAt: '2026-01-03T00:00:00.000Z' })]
      ]
    )
    const before = canonicalJsonRecordSchema.parse(play.fields)
    const after = canonicalJsonRecordSchema.parse({
      ...play.fields,
      streamVersion: 9,
      updatedAt: '2026-01-03T00:00:00.000Z'
    })
    expect(result.changes).toHaveLength(1)
    expect(applyJsonDelta(before, result.changes[0]!.delta!)).toEqual(after)
    expect(result.changes[0]!.nextChecksum).toBe(checksumCanonicalJson(after))
  })

  it('uses the actual checksum-verified snapshot and committed room journal', async () => {
    const { storage, database } = createNodeSqliteRoomStorage()
    try {
      const room = new RoomEncounterStore(storage)
      room.hydrate({ epoch: uuid(9), ...aggregate(2) })
      const snapshot = room.checkpointSnapshot()
      for (const hp of [9, 7])
        await room.transact(async () => {
          const row = await room.store
            .query('encounterRunActors')
            .withIndex('by_encounterId_id', (query) =>
              query.eq('encounterId', encounterId).eq('id', uuid(0x100))
            )
            .unique()
          const state = JSON.parse(row!.stateJson) as Record<string, unknown>
          await room.store.patch(row!._id, {
            stateJson: JSON.stringify({ ...state, hitPoints: hp })
          })
        })
      const entries = room.committedWriteSets({
        epoch: snapshot.epoch,
        fromSequence: snapshot.sequence,
        fromChecksum: snapshot.checksum,
        toSequence: room.sequence,
        maxEntries: 100,
        maxBytes: LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES
      }).entries
      const result = buildRoomCheckpointRecords({
        documents: snapshot.documents,
        records: snapshot.records,
        fromSequence: snapshot.sequence,
        fromChecksum: snapshot.checksum,
        entries
      })
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0]!.key).toEqual([encounterId, uuid(0x100)])
      expect(result.changes[0]!.delta).toEqual({
        keys: { stateJson: { keys: { hitPoints: { set: 7 } }, drop: [] } },
        drop: []
      })
      expect(JSON.stringify(result.changes[0]!.delta).length).toBeLessThan(150)
      expect(new RoomEncounterStore(storage).checkpointSnapshot()).toEqual(snapshot)
    } finally {
      database.close()
    }
  })
})
