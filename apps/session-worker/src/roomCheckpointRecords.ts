import {
  liveSessionCheckpointKeyFields,
  liveSessionCheckpointHistoryKeyFields,
  liveSessionCheckpointRecordsSchema,
  liveSessionRoomWriteSetSchema,
  liveSessionCheckpointRetainedRollSchema,
  type LiveSessionCheckpointRetainedRoll,
  type LiveSessionCheckpointRecords,
  type LiveSessionCheckpointTable,
  type LiveSessionCheckpointHistoryTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import {
  liveSessionCheckpointJournalEntrySchema,
  type LiveSessionCheckpointJournalEntry
} from '@artificer-toolkit/schema/api/liveSessionCheckpointJournal'
import {
  liveSessionCheckpointSceneSchemas,
  liveSessionCheckpointSceneKeys,
  liveSessionCheckpointSceneSourceSchema,
  type LiveSessionCheckpointSceneTable,
  type LiveSessionCheckpointSceneSource
} from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import { encounterStoreSchemas } from '@artificer-toolkit/schema/projections/encounterStore'
import { projectionChecksumSchema } from '@artificer-toolkit/schema/projections/identity'
import {
  canonicalJsonRecordSchema,
  type JsonValue
} from '@artificer-toolkit/schema/shared/jsonDelta'
import { diffJson } from '@artificer-toolkit/encounter-persistence/jsonDelta'
import { decodeCheckpointRecord } from '@artificer-toolkit/encounter-persistence/checkpointRecords'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import type { RoomDocument, RoomRecord } from './roomEncounterStore.js'
import { ROOM_PRIVATE_ROLL } from './roomPrivateRolls.js'

type Table = keyof typeof encounterStoreSchemas
type CheckpointRecord = {
  table: LiveSessionCheckpointTable | LiveSessionCheckpointHistoryTable
  key: (string | number)[]
  value: Record<string, JsonValue>
}

function isMutable(table: string): table is LiveSessionCheckpointTable {
  return Object.hasOwn(liveSessionCheckpointKeyFields, table)
}

function isHistory(table: string): table is LiveSessionCheckpointHistoryTable {
  return Object.hasOwn(liveSessionCheckpointHistoryKeyFields, table)
}

function validateFields(table: Table, fields: unknown) {
  encounterStoreSchemas[table].parse(fields)
  return canonicalJsonRecordSchema.parse(structuredClone(fields))
}

function checkpointKey(
  table: LiveSessionCheckpointTable | LiveSessionCheckpointHistoryTable,
  fields: Record<string, unknown>
) {
  const keyFields = isMutable(table)
    ? liveSessionCheckpointKeyFields[table]
    : liveSessionCheckpointHistoryKeyFields[table]
  return keyFields.map((field) => {
    const value = fields[field]
    if (typeof value !== 'string' && typeof value !== 'number')
      throw new Error(`Missing checkpoint identity ${table}.${field}.`)
    return value
  })
}

function checkpointRecord(
  table: Table,
  fields: Record<string, JsonValue>
): CheckpointRecord | null {
  if (!isMutable(table) && !isHistory(table)) return null
  return { table, key: checkpointKey(table, fields), value: decodeCheckpointRecord(table, fields) }
}

const identityOf = (table: string, key: readonly (string | number)[]) =>
  `${table}:${canonicalizeJson(key)}`
const recordId = (record: CheckpointRecord) => identityOf(record.table, record.key)

type SceneRecord = {
  table: LiveSessionCheckpointSceneTable
  key: (string | number | null)[]
  value: Record<string, JsonValue>
}

function isMutableScene(table: LiveSessionCheckpointSceneTable): boolean {
  return ['sceneLiveStates', 'sceneLiveEntities', 'sceneFogLayers'].includes(table)
}

function sceneRecord(record: RoomRecord): SceneRecord {
  const key: unknown = JSON.parse(record.key)
  if (
    !Array.isArray(key) ||
    typeof key[0] !== 'string' ||
    !Object.hasOwn(liveSessionCheckpointSceneSchemas, key[0])
  )
    throw new Error('Invalid checkpoint Scene table key.')
  const table = key[0] as LiveSessionCheckpointSceneTable
  const value = canonicalJsonRecordSchema.parse(JSON.parse(record.json))
  liveSessionCheckpointSceneSchemas[table].parse(value)
  for (const field of ['input', 'result', 'previousLayer']) {
    const nested = value[field]
    if (
      nested &&
      typeof nested === 'object' &&
      !Array.isArray(nested) &&
      Object.hasOwn(nested, 'sceneId') &&
      nested.sceneId !== value.sceneId
    )
      throw new Error('Checkpoint Scene row scope does not match its group.')
  }
  const publicKey = liveSessionCheckpointSceneKeys[table].map((field) => {
    const valuePart = value[field]
    if (typeof valuePart !== 'string' && typeof valuePart !== 'number' && valuePart !== null)
      throw new Error(`Missing checkpoint Scene identity ${table}.${field}.`)
    return valuePart
  })
  if (record.key !== canonicalizeJson([table, ...publicKey]))
    throw new Error('Checkpoint Scene key does not match its row.')
  if (record.json !== canonicalizeJson(value))
    throw new Error('Checkpoint Scene row JSON must be canonical.')
  return { table, key: publicKey, value }
}

/**
 * Replays committed writes from the persisted base and folds mutable rows by public identity. The
 * base is the store's acknowledged snapshot, which it validated when hydrating or replaying, so only
 * the rows the entries touch are validated and decoded here: a build costs its range, not the Run's
 * retained history. `entries` is consumed once, so a caller can stream a range page by page.
 */
export function buildRoomCheckpointRecords({
  documents,
  records,
  fromSequence,
  fromChecksum,
  entries
}: {
  documents: readonly RoomDocument[]
  records: readonly RoomRecord[]
  fromSequence: number
  fromChecksum: string
  entries: Iterable<LiveSessionCheckpointJournalEntry>
}): LiveSessionCheckpointRecords {
  if (!Number.isSafeInteger(fromSequence) || fromSequence < 0)
    throw new Error('Invalid checkpoint base sequence.')
  projectionChecksumSchema.parse(fromChecksum)
  const state = new Map<string, { table: Table; fields: Record<string, JsonValue> }>()
  const owners = new Map<string, string>()
  const before = new Map<string, CheckpointRecord>()
  const after = new Map<string, CheckpointRecord>()
  const history: LiveSessionCheckpointRecords['history'] = []
  const privateRollState = new Map<string, string>()
  const retainedRolls = new Map<string, LiveSessionCheckpointRetainedRoll>()
  const setPrivateRoll = (record: RoomRecord) => {
    if (record.kind !== ROOM_PRIVATE_ROLL) return
    const value = liveSessionCheckpointRetainedRollSchema.parse(JSON.parse(record.json))
    const key = canonicalizeJson([value.userId, value.record.id])
    if (record.key !== key || record.revision !== null || record.json !== canonicalizeJson(value))
      throw new Error('Private roll checkpoint identity or canonical payload is invalid.')
    const previous = privateRollState.get(key)
    const pending = retainedRolls.get(key)
    // Evidence is immutable; only the binding's reveal marks advance, so the last one wins.
    const evidence = (roll: LiveSessionCheckpointRetainedRoll) =>
      canonicalizeJson([roll.userId, roll.record])
    if (
      (previous &&
        evidence(liveSessionCheckpointRetainedRollSchema.parse(JSON.parse(previous))) !==
          evidence(value)) ||
      (pending && evidence(pending) !== evidence(value))
    )
      throw new Error('Private roll checkpoint evidence is immutable.')
    privateRollState.set(key, record.json)
    retainedRolls.set(key, value)
  }
  const sources = new Map<string, LiveSessionCheckpointSceneSource>()
  const unreadScenes = new Map<string, RoomRecord>()
  const sceneBefore = new Map<string, SceneRecord>()
  const sceneAfter = new Map<string, SceneRecord>()
  const readScene = (key: string) => {
    const record = unreadScenes.get(key)
    if (!record) return
    unreadScenes.delete(key)
    const row = sceneRecord(record)
    sceneBefore.set(key, row)
    sceneAfter.set(key, row)
  }
  const setSceneRecord = (record: RoomRecord, baseline: boolean) => {
    if (!record.kind.startsWith('SCENE_CHECKPOINT_')) return
    if (record.revision !== null) throw new Error('Checkpoint Scene revision must be null.')
    if (record.kind === 'SCENE_CHECKPOINT_SOURCE') {
      const source = liveSessionCheckpointSceneSourceSchema.parse(JSON.parse(record.json))
      if (record.key !== source.sceneId || record.json !== canonicalizeJson(source))
        throw new Error('Checkpoint Scene source key or canonical JSON is invalid.')
      const previous = sources.get(source.sceneId)
      if (previous && (baseline || canonicalizeJson(previous) !== record.json))
        throw new Error('Duplicate or changed checkpoint Scene source pins.')
      sources.set(source.sceneId, source)
      return
    }
    if (record.kind !== 'SCENE_CHECKPOINT_ROW')
      throw new Error('Unknown checkpoint Scene record kind.')
    if (baseline) {
      if (unreadScenes.has(record.key)) throw new Error('Duplicate checkpoint Scene public key.')
      unreadScenes.set(record.key, record)
      return
    }
    const row = sceneRecord(record)
    readScene(record.key)
    const previous = sceneAfter.get(record.key) ?? sceneBefore.get(record.key)
    if (previous && previous.value.sceneId !== row.value.sceneId)
      throw new Error('Checkpoint Scene row scope cannot change.')
    if (
      previous &&
      !isMutableScene(row.table) &&
      checksumCanonicalJson(previous.value) !== checksumCanonicalJson(row.value)
    )
      throw new Error('Checkpoint Scene evidence is append-only.')
    sceneAfter.set(record.key, row)
  }
  for (const record of records) {
    if (record.kind !== ROOM_PRIVATE_ROLL) setSceneRecord(record, true)
    else if (privateRollState.has(record.key))
      throw new Error('Private roll checkpoint identity is duplicated.')
    else privateRollState.set(record.key, record.json)
  }

  const unread = new Map<string, RoomDocument>()
  for (const document of documents) {
    if (typeof document.id !== 'string' || !document.id || unread.has(document.id))
      throw new Error('Missing or duplicate storage id.')
    unread.set(document.id, document)
    const { table } = document
    if (!isMutable(table) && !isHistory(table)) continue
    const identity = identityOf(table, checkpointKey(table, document.fields))
    if (owners.has(identity)) throw new Error(`Duplicate public key ${identity}.`)
    owners.set(identity, document.id)
  }
  const validDocument = (document: RoomDocument) => {
    if (!Number.isFinite(document.creationTime) || document.creationTime < 0)
      throw new Error('Invalid document creation time.')
    if (!Object.hasOwn(encounterStoreSchemas, document.table))
      throw new Error(`Unknown room table ${document.table}.`)
    const table = document.table as Table
    return { table, fields: validateFields(table, document.fields) }
  }
  /** A held document, validated and decoded the first time the page touches it. */
  const read = (id: string) => {
    const document = unread.get(id)
    if (!document) return state.get(id)
    unread.delete(id)
    const held = validDocument(document)
    const record = checkpointRecord(held.table, held.fields)
    if (record && isMutable(record.table)) {
      before.set(recordId(record), record)
      after.set(recordId(record), record)
    }
    state.set(id, held)
    return held
  }
  const insert = (document: RoomDocument, evidence: boolean) => {
    if (
      typeof document.id !== 'string' ||
      !document.id ||
      state.has(document.id) ||
      unread.has(document.id)
    )
      throw new Error('Missing or duplicate storage id.')
    const { table, fields } = validDocument(document)
    const record = checkpointRecord(table, fields)
    if (record) {
      const identity = recordId(record)
      if (owners.has(identity)) throw new Error(`Duplicate public key ${identity}.`)
      owners.set(identity, document.id)
      if (isMutable(record.table)) after.set(identity, record)
      else if (evidence)
        history.push({
          ...record,
          table: record.table,
          checksum: checksumCanonicalJson(record.value)
        })
    }
    state.set(document.id, { table, fields })
  }

  let sequence = fromSequence
  let chain = fromChecksum
  for (const rawEntry of entries) {
    const entry = liveSessionCheckpointJournalEntrySchema.parse(rawEntry)
    if (entry.sequence !== sequence + 1) throw new Error('Checkpoint journal is out of sequence.')
    if (sha256Hex(entry.writeSetJson) !== entry.writeSetChecksum)
      throw new Error('Checkpoint write-set checksum does not match.')
    if (sha256Hex(`${chain}:${entry.writeSetChecksum}`) !== entry.chainChecksum)
      throw new Error('Checkpoint journal chain checksum does not match.')
    const writes = liveSessionRoomWriteSetSchema.parse(JSON.parse(entry.writeSetJson))
    for (const write of writes) {
      if (write.op === 'RECORD_SET') {
        setSceneRecord(write.record, false)
        setPrivateRoll(write.record)
        continue
      }
      if (write.op === 'RECORD_DELETE') {
        if (write.kind === ROOM_PRIVATE_ROLL) {
          if (!privateRollState.delete(write.key))
            throw new Error('Private roll checkpoint retention deleted an unknown roll.')
          continue
        }
        if (write.kind === 'SCENE_CHECKPOINT_SOURCE')
          throw new Error('Checkpoint Scene source cannot be deleted.')
        if (write.kind === 'SCENE_CHECKPOINT_ROW') {
          readScene(write.key)
          const row = sceneAfter.get(write.key)
          if (!row) throw new Error('Dangling checkpoint Scene row deletion.')
          if (!isMutableScene(row.table))
            throw new Error('Checkpoint Scene evidence is append-only.')
          sceneAfter.delete(write.key)
        } else if (write.kind.startsWith('SCENE_CHECKPOINT_'))
          throw new Error('Unknown checkpoint Scene record kind.')
        continue
      }
      if (write.op === 'INSERT') {
        insert(write, true)
        continue
      }
      if (write.op === 'RESTORE') {
        const previous = read(write.id)
        if (!previous) {
          const restored = checkpointRecord(write.table, validateFields(write.table, write.fields))
          if (restored && before.has(recordId(restored)))
            throw new Error('Restored room input cannot replace uncheckpointed state or history.')
          insert(write, false)
          if (restored && isMutable(restored.table)) before.set(recordId(restored), restored)
          continue
        }
        if (previous.table !== write.table)
          throw new Error('Restored room input cannot change its table.')
        const fields = validateFields(write.table, write.fields)
        const held = checkpointRecord(previous.table, previous.fields)
        const restored = checkpointRecord(write.table, fields)
        if (held && restored) {
          const identity = recordId(held)
          if (recordId(restored) !== identity)
            throw new Error('Restored room input cannot change its identity.')
          if (checksumCanonicalJson(held.value) !== checksumCanonicalJson(restored.value)) {
            if (
              !isMutable(restored.table) ||
              checksumCanonicalJson(before.get(identity)?.value ?? null) !==
                checksumCanonicalJson(after.get(identity)?.value ?? null)
            )
              throw new Error('Restored room input cannot replace uncheckpointed state or history.')
            before.set(identity, restored)
            after.set(identity, restored)
          }
        }
        state.set(write.id, { table: write.table, fields })
        continue
      }
      const document = read(write.id)
      if (!document) throw new Error(`Dangling checkpoint write ${write.id}.`)
      if (isHistory(document.table)) throw new Error('Checkpoint history is append-only.')
      const previous = checkpointRecord(document.table, document.fields)
      if (write.op === 'DELETE') {
        state.delete(write.id)
        if (previous) {
          owners.delete(recordId(previous))
          after.delete(recordId(previous))
        }
        continue
      }
      const fields =
        write.op === 'PATCH'
          ? Object.fromEntries(
              Object.entries({ ...document.fields, ...write.fields }).filter(
                ([field]) => !write.remove.includes(field)
              )
            )
          : write.fields
      const validated = validateFields(document.table, fields)
      const next = checkpointRecord(document.table, validated)
      if (previous && next) {
        if (recordId(previous) !== recordId(next))
          throw new Error('Checkpoint identity cannot change.')
        after.set(recordId(next), next)
      }
      state.set(write.id, { table: document.table, fields: validated })
    }
    sequence = entry.sequence
    chain = entry.chainChecksum
  }

  const changes: LiveSessionCheckpointRecords['changes'] = []
  const identities = [...new Set([...before.keys(), ...after.keys()])].sort()
  for (const identity of identities) {
    const previous = before.get(identity)
    const next = after.get(identity)
    const record = next ?? previous!
    if (!isMutable(record.table)) continue
    const previousChecksum = previous ? checksumCanonicalJson(previous.value) : null
    const nextChecksum = next ? checksumCanonicalJson(next.value) : null
    if (previousChecksum === nextChecksum) continue
    changes.push({
      table: record.table,
      key: record.key,
      previousChecksum,
      nextChecksum,
      delta: next ? (previous ? diffJson(previous.value, next.value) : { set: next.value }) : null
    })
  }
  const sceneIdFor = (row: SceneRecord, rows: ReadonlyMap<string, SceneRecord>): string => {
    let sceneId: unknown = row.value.sceneId
    if (row.table === 'sceneFogChunks') {
      const save = canonicalizeJson(['sceneFogSaves', row.value.saveId])
      readScene(save)
      sceneId = rows.get(save)?.value.sceneId
    }
    if (typeof sceneId !== 'string' || !sources.has(sceneId))
      throw new Error('Checkpoint Scene row has a missing source or fog save.')
    return sceneId
  }
  for (const row of [...sceneBefore.values()]) sceneIdFor(row, sceneBefore)
  for (const row of [...sceneAfter.values()]) sceneIdFor(row, sceneAfter)
  const grouped = new Map<string, LiveSessionCheckpointRecords['scenes'][number]['changes']>()
  for (const identity of [...new Set([...sceneBefore.keys(), ...sceneAfter.keys()])].sort()) {
    const previous = sceneBefore.get(identity)
    const next = sceneAfter.get(identity)
    const row = next ?? previous!
    const sceneId = sceneIdFor(row, next ? sceneAfter : sceneBefore)
    const previousChecksum = previous ? checksumCanonicalJson(previous.value) : null
    const nextChecksum = next ? checksumCanonicalJson(next.value) : null
    if (previousChecksum === nextChecksum) continue
    const rows = grouped.get(sceneId) ?? []
    rows.push({
      table: row.table,
      key: row.key,
      previousChecksum,
      nextChecksum,
      delta: next ? (previous ? diffJson(previous.value, next.value) : { set: next.value }) : null
    })
    grouped.set(sceneId, rows)
  }
  const scenes = [...grouped]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sceneId, sceneChanges]) => {
      const identity = canonicalizeJson(['sceneLiveStates', sceneId])
      readScene(identity)
      const fromVersion = sceneBefore.get(identity)?.value.version ?? 0
      const toVersion = sceneAfter.get(identity)?.value.version ?? 0
      if (
        typeof fromVersion !== 'number' ||
        typeof toVersion !== 'number' ||
        toVersion < fromVersion ||
        (toVersion === fromVersion && sceneChanges.some(({ table }) => isMutableScene(table)))
      )
        throw new Error('Checkpoint Scene live head must advance.')
      return {
        ...sources.get(sceneId)!,
        fromVersion,
        toVersion,
        changes: sceneChanges
      }
    })
  return liveSessionCheckpointRecordsSchema.parse({
    changes,
    history,
    scenes,
    ...(retainedRolls.size ? { retainedRolls: [...retainedRolls.values()] } : {})
  })
}
