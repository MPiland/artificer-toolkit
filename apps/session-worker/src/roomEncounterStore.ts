import {
  createMemoryEncounterStore,
  type EncounterStoreWrite
} from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import type {
  EncounterDocument,
  EncounterStore,
  EncounterTableName
} from '@artificer-toolkit/encounter-persistence/store'
import { encounterStoreSchemas } from '@artificer-toolkit/encounter-persistence/storeTables'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'

/** The Durable Object SQLite surface the room store uses; `DurableObjectStorage` satisfies it. */
export type RoomSqlValue = string | number | ArrayBuffer | null
export interface RoomSqlCursor {
  toArray(): Record<string, RoomSqlValue>[]
  readonly rowsRead: number
  readonly rowsWritten: number
}
export interface RoomStorage {
  readonly sql: { exec(query: string, ...bindings: RoomSqlValue[]): RoomSqlCursor }
  transactionSync<Result>(closure: () => Result): Result
}

/**
 * An opaque stored record the room keeps beside the Encounter documents: a Character's play state,
 * or a cached rules input with the revision it was read at. It commits and snapshots with the
 * documents, all or nothing.
 */
export interface RoomRecord {
  kind: string
  key: string
  revision: string | null
  json: string
}

type RecordWrite =
  | { op: 'RECORD_SET'; record: RoomRecord }
  | { op: 'RECORD_DELETE'; kind: string; key: string }
type RoomWrite = EncounterStoreWrite | RecordWrite
type StoredDocument = Record<string, unknown> & { _id: string; _creationTime: number }
type Memory = ReturnType<typeof createMemoryEncounterStore>

interface SnapshotContent {
  counters: { clock: number; sequence: number }
  documents: Partial<Record<EncounterTableName, StoredDocument[]>>
  records: RoomRecord[]
}

/** A hydrated document, as the room-inputs read returns it. */
export interface RoomDocument {
  table: string
  id: string
  creationTime: number
  fields: Record<string, unknown>
}

/** What a command's work may do beyond the store: restore Convex documents and change records. */
export interface RoomTransaction {
  /** Inserts a document with its Convex identity and creation time. */
  restoreDocument(document: RoomDocument): void
  /** The record as this command sees it, staged changes included. */
  record(kind: string, key: string): RoomRecord | null
  setRecord(record: RoomRecord): void
  deleteRecord(kind: string, key: string): void
}

/** The persisted state cannot be trusted; the room must load a new epoch from Convex. */
export class RoomStoreCorruptError extends Error {
  constructor(reason: string) {
    super(`Room store is corrupt: ${reason}`)
    this.name = 'RoomStoreCorruptError'
  }
}

/** One command's writes exceed a log row; the command is aborted, never split. */
export class RoomWriteSetTooLargeError extends Error {
  constructor(size: number) {
    super(`Room command write set of ${size} characters exceeds the log row limit.`)
    this.name = 'RoomWriteSetTooLargeError'
  }
}

/** A statement's bound text stays under Durable Object SQLite's 100 KB statement limit. */
const SNAPSHOT_CHUNK_CHARS = 96_000
/** A log row stays under the 2 MB row limit; the JSON is ASCII, so characters are bytes. */
const MAX_WRITE_SET_CHARS = 1_800_000
const TABLES = Object.keys(encounterStoreSchemas) as EncounterTableName[]
const EMPTY_CHAIN = sha256Hex('room-store:empty')

/** JSON with every non-ASCII character escaped, so a string's length is its byte length. */
function asciiJson(value: unknown) {
  return JSON.stringify(value).replace(
    /[\u007f-￿]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
}

const recordId = (kind: string, key: string) => `${kind}\u0000${key}`
const chainOf = (previous: string, checksum: string) => sha256Hex(`${previous}:${checksum}`)

function text(row: Record<string, RoomSqlValue>, column: string) {
  const value = row[column]
  if (typeof value !== 'string') throw new RoomStoreCorruptError(`column ${column} is not text`)
  return value
}

function integer(row: Record<string, RoomSqlValue>, column: string) {
  const value = row[column]
  if (typeof value !== 'number' || !Number.isSafeInteger(value))
    throw new RoomStoreCorruptError(`column ${column} is not an integer`)
  return value
}

function isTable(value: string): value is EncounterTableName {
  return value in encounterStoreSchemas
}

function loadTable(
  memory: Memory,
  table: EncounterTableName,
  documents: StoredDocument[],
  validate: boolean
) {
  // One generic loader serves every table; the caller has matched each document to its table.
  memory.load(table, documents as unknown as EncounterDocument<typeof table>[], { validate })
}

/**
 * The room's authoritative Encounter store (ADR 0035): the Run aggregate lives in memory and is
 * persisted in Durable Object SQLite as a snapshot (`room_snapshot_chunks`) plus a log with one row
 * per command's write set (`room_writeset_log`). The state checksum is a chain over the write sets,
 * `H(previous || write set checksum)`, so two rooms holding the same commands hold the same checksum.
 *
 * Durability: a command commits with a single SQLite transaction that inserts one log row, and
 * the in-memory aggregate follows only after that succeeds. A crash or eviction before it loses the
 * command completely (its memory was never durable); after it, the row alone reproduces the command.
 * Rehydration applies rows in order and discards an invalid last row (a command that never
 * committed); an invalid row anywhere else, or a broken snapshot, leaves the store empty and
 * reports {@link RoomStoreCorruptError} as `corruption`. Compaction folds the log into a new snapshot generation atomically.
 */
export class RoomEncounterStore {
  /** Reads pass through; writes are refused outside {@link transact}. */
  readonly store: EncounterStore

  readonly #storage: RoomStorage
  #memory: Memory = createMemoryEncounterStore({ idPrefix: 'room' })
  #records = new Map<string, RoomRecord>()
  #epoch: string | null = null
  #generation = 0
  #snapshotSequence = 0
  #sequence = 0
  #chain = EMPTY_CHAIN
  #open = false
  #corruption: RoomStoreCorruptError | null = null
  #rowsRead = 0
  #rowsWritten = 0

  constructor(storage: RoomStorage) {
    this.#storage = storage
    const mutations = new Set(['insert', 'patch', 'replace', 'delete'])
    this.store = new Proxy({} as EncounterStore, {
      get: (_target, property) => {
        const member: unknown = Reflect.get(this.#memory.store, property)
        if (typeof property !== 'string' || typeof member !== 'function') return member
        return mutations.has(property)
          ? async (...args: unknown[]) => {
              if (!this.#open)
                throw new Error('The room store is written only inside a room command.')
              return member.apply(this.#memory.store, args)
            }
          : member.bind(this.#memory.store)
      }
    })
    this.#exec(`CREATE TABLE IF NOT EXISTS room_snapshot_chunks (
      generation INTEGER NOT NULL,
      part INTEGER NOT NULL,
      part_count INTEGER NOT NULL,
      epoch TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      chain TEXT NOT NULL,
      content_checksum TEXT NOT NULL,
      content TEXT NOT NULL,
      PRIMARY KEY (generation, part)
    )`)
    this.#exec(`CREATE TABLE IF NOT EXISTS room_writeset_log (
      sequence INTEGER PRIMARY KEY,
      json TEXT NOT NULL,
      checksum TEXT NOT NULL,
      chain TEXT NOT NULL
    )`)
    try {
      this.#recover()
    } catch (error) {
      if (!(error instanceof RoomStoreCorruptError)) throw error
      this.#discard(error)
    }
  }

  /**
   * Why the persisted store could not be rebuilt, or null. A corrupt store is empty with no epoch, so
   * the next hydrate replaces it; whether Convex still holds every command of the epoch, or a new
   * epoch is needed, is the caller's decision.
   */
  get corruption() {
    return this.#corruption
  }

  /** The Convex authority epoch the aggregate was loaded for; null before the first hydrate. */
  get epoch() {
    return this.#epoch
  }

  /** The chain checksum of every command applied since the last hydrate. */
  get checksum() {
    return this.#chain
  }

  /** The number of commands applied since the last hydrate. */
  get sequence() {
    return this.#sequence
  }

  /** Log rows not yet folded into a snapshot. */
  get logRows() {
    return this.#sequence - this.#snapshotSequence
  }

  /** SQLite rows read and written by this store since it was constructed. */
  get usage() {
    return { rowsRead: this.#rowsRead, rowsWritten: this.#rowsWritten }
  }

  documents<Table extends EncounterTableName>(table: Table) {
    return this.#memory.documents(table)
  }

  record(kind: string, key: string) {
    const record = this.#records.get(recordId(kind, key))
    return record ? { ...record } : null
  }

  records(kind: string) {
    return [...this.#records.values()]
      .filter((record) => record.kind === kind)
      .sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0))
  }

  /**
   * Loads a Convex-read aggregate as a new snapshot generation, replacing everything (a new epoch
   * or a store found corrupt). Documents are validated; nothing changes if any is invalid.
   */
  hydrate({
    epoch,
    documents,
    records
  }: {
    epoch: string
    documents: readonly RoomDocument[]
    records: readonly RoomRecord[]
  }) {
    this.#assertClosed()
    const unknown = documents.find((document) => !isTable(document.table))
    if (unknown) throw new Error(`Unknown room table ${unknown.table}.`)
    const memory = createMemoryEncounterStore({ idPrefix: 'room' })
    for (const table of TABLES)
      loadTable(
        memory,
        table,
        documents
          .filter((document) => document.table === table)
          .map(({ id, creationTime, fields }) => ({
            ...fields,
            _id: id,
            _creationTime: creationTime
          })),
        true
      )
    const recordMap = new Map(records.map((record) => [recordId(record.kind, record.key), record]))
    const content = this.#content(memory, recordMap)
    const serialized = asciiJson(content)
    const chain = sha256Hex(`room-store:genesis:${sha256Hex(serialized)}`)
    this.#persistSnapshot({ epoch, sequence: 0, chain, serialized })
    this.#memory = memory
    this.#records = recordMap
    this.#epoch = epoch
    this.#snapshotSequence = 0
    this.#sequence = 0
    this.#chain = chain
    this.#corruption = null
  }

  /**
   * Runs one command's writes as an all-or-nothing overlay. If `work` throws or the write set
   * cannot be logged, every change is discarded; otherwise one log row is committed and the change
   * becomes the new state. A command that changes nothing writes no row.
   */
  async transact<Result>(work: (transaction: RoomTransaction) => Promise<Result>): Promise<Result> {
    this.#assertClosed()
    this.#open = true
    this.#memory.transaction.begin()
    const staged = new Map<string, RoomRecord | null>()
    const recordWrites: RecordWrite[] = []
    const transaction: RoomTransaction = {
      restoreDocument: ({ table, id, creationTime, fields }) => {
        if (!isTable(table)) throw new Error(`Unknown room table ${table}.`)
        this.#memory.apply([{ op: 'INSERT', table, id, creationTime, fields }])
      },
      record: (kind, key) => {
        const id = recordId(kind, key)
        const record = staged.has(id) ? staged.get(id) : this.#records.get(id)
        return record ? { ...record } : null
      },
      setRecord: (record) => {
        staged.set(recordId(record.kind, record.key), { ...record })
        recordWrites.push({ op: 'RECORD_SET', record: { ...record } })
      },
      deleteRecord: (kind, key) => {
        staged.set(recordId(kind, key), null)
        recordWrites.push({ op: 'RECORD_DELETE', kind, key })
      }
    }
    try {
      const result = await work(transaction)
      const writes: RoomWrite[] = [...this.#memory.transaction.writes(), ...recordWrites]
      if (writes.length > 0) this.#logWrites(writes)
      this.#memory.transaction.commit()
      for (const [id, record] of staged)
        if (record) this.#records.set(id, record)
        else this.#records.delete(id)
      return result
    } catch (error) {
      this.#memory.transaction.abort()
      throw error
    } finally {
      this.#open = false
    }
  }

  /**
   * Folds the log into a new snapshot generation at the current sequence and chain, so the state
   * checksum is unchanged. Snapshot, old chunks and folded rows change in one SQLite transaction.
   */
  compact() {
    this.#assertClosed()
    if (this.logRows === 0) return
    this.#persistSnapshot({
      epoch: this.#requireEpoch(),
      sequence: this.#sequence,
      chain: this.#chain,
      serialized: asciiJson(this.#content(this.#memory, this.#records))
    })
    this.#snapshotSequence = this.#sequence
  }

  #assertClosed() {
    if (this.#open) throw new Error('A room command is already running.')
  }

  #requireEpoch() {
    if (!this.#epoch) throw new Error('The room store has not been hydrated.')
    return this.#epoch
  }

  #exec(query: string, ...bindings: RoomSqlValue[]) {
    const cursor = this.#storage.sql.exec(query, ...bindings)
    const rows = cursor.toArray()
    this.#rowsRead += cursor.rowsRead
    this.#rowsWritten += cursor.rowsWritten
    return rows
  }

  #content(memory: Memory, records: ReadonlyMap<string, RoomRecord>): SnapshotContent {
    const documents: SnapshotContent['documents'] = {}
    for (const table of TABLES) {
      const rows = memory.documents(table)
      if (rows.length > 0) documents[table] = rows as unknown as StoredDocument[]
    }
    return {
      counters: memory.counters(),
      documents,
      records: [...records.values()].sort(
        (left, right) =>
          left.kind.localeCompare(right.kind, 'en') || left.key.localeCompare(right.key, 'en')
      )
    }
  }

  #persistSnapshot({
    epoch,
    sequence,
    chain,
    serialized
  }: {
    epoch: string
    sequence: number
    chain: string
    serialized: string
  }) {
    const generation = this.#generation + 1
    const checksum = sha256Hex(serialized)
    const parts = Math.max(1, Math.ceil(serialized.length / SNAPSHOT_CHUNK_CHARS))
    this.#storage.transactionSync(() => {
      for (let part = 0; part < parts; part++)
        this.#exec(
          `INSERT INTO room_snapshot_chunks
            (generation, part, part_count, epoch, sequence, chain, content_checksum, content)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          generation,
          part,
          parts,
          epoch,
          sequence,
          chain,
          checksum,
          serialized.slice(part * SNAPSHOT_CHUNK_CHARS, (part + 1) * SNAPSHOT_CHUNK_CHARS)
        )
      this.#exec('DELETE FROM room_snapshot_chunks WHERE generation < ?', generation)
      this.#exec('DELETE FROM room_writeset_log')
    })
    this.#generation = generation
  }

  #logWrites(writes: readonly RoomWrite[]) {
    const json = asciiJson(writes)
    if (json.length > MAX_WRITE_SET_CHARS) throw new RoomWriteSetTooLargeError(json.length)
    const checksum = sha256Hex(json)
    const chain = chainOf(this.#chain, checksum)
    const sequence = this.#sequence + 1
    this.#storage.transactionSync(() => {
      this.#exec(
        'INSERT INTO room_writeset_log (sequence, json, checksum, chain) VALUES (?, ?, ?, ?)',
        sequence,
        json,
        checksum,
        chain
      )
    })
    this.#sequence = sequence
    this.#chain = chain
  }

  /** Forgets a store that could not be rebuilt, keeping the generation so a hydrate supersedes it. */
  #discard(corruption: RoomStoreCorruptError) {
    const [newest] = this.#exec('SELECT MAX(generation) AS generation FROM room_snapshot_chunks')
    this.#memory = createMemoryEncounterStore({ idPrefix: 'room' })
    this.#records = new Map()
    this.#epoch = null
    this.#generation = newest && typeof newest['generation'] === 'number' ? newest['generation'] : 0
    this.#snapshotSequence = 0
    this.#sequence = 0
    this.#chain = EMPTY_CHAIN
    this.#corruption = corruption
  }

  #recover() {
    const chunks = this.#exec(
      `SELECT generation, part, part_count, epoch, sequence, chain, content_checksum, content
       FROM room_snapshot_chunks
       WHERE generation = (SELECT MAX(generation) FROM room_snapshot_chunks)
       ORDER BY part`
    )
    const rows = this.#exec(
      'SELECT sequence, json, checksum, chain FROM room_writeset_log ORDER BY sequence'
    )
    if (chunks.length === 0) {
      if (rows.length > 0) throw new RoomStoreCorruptError('a write-set log has no snapshot')
      return
    }
    this.#loadSnapshot(chunks)
    for (const [index, row] of rows.entries()) {
      const failure = this.#replayRow(row)
      if (!failure) continue
      // A row is written only when its command commits, so an invalid last row is a write that was
      // torn; it never acknowledged and is dropped. An invalid row before a valid one is damage.
      if (index !== rows.length - 1)
        throw new RoomStoreCorruptError(`log row ${String(row['sequence'])} is ${failure}`)
      this.#exec('DELETE FROM room_writeset_log WHERE sequence = ?', integer(row, 'sequence'))
    }
  }

  #loadSnapshot(chunks: Record<string, RoomSqlValue>[]) {
    const [first] = chunks
    const parts = integer(first!, 'part_count')
    const header = ['generation', 'epoch', 'sequence', 'chain', 'content_checksum'] as const
    if (
      chunks.length !== parts ||
      chunks.some(
        (chunk, part) =>
          integer(chunk, 'part') !== part ||
          integer(chunk, 'part_count') !== parts ||
          header.some((column) => chunk[column] !== first![column])
      )
    )
      throw new RoomStoreCorruptError('the snapshot is incomplete')
    const serialized = chunks.map((chunk) => text(chunk, 'content')).join('')
    if (sha256Hex(serialized) !== text(first!, 'content_checksum'))
      throw new RoomStoreCorruptError('the snapshot checksum does not match')
    // The checksum covers the text, so the shape below was written by this store.
    const content = JSON.parse(serialized) as SnapshotContent
    const memory = createMemoryEncounterStore({ idPrefix: 'room' })
    for (const table of TABLES) {
      const documents = content.documents[table]
      if (documents) loadTable(memory, table, documents, false)
    }
    memory.restoreCounters(content.counters)
    this.#memory = memory
    this.#records = new Map(
      content.records.map((record) => [recordId(record.kind, record.key), record])
    )
    this.#generation = integer(first!, 'generation')
    this.#epoch = text(first!, 'epoch')
    this.#snapshotSequence = integer(first!, 'sequence')
    this.#sequence = this.#snapshotSequence
    this.#chain = text(first!, 'chain')
  }

  /** Applies one log row, or returns why it is invalid without having changed anything. */
  #replayRow(row: Record<string, RoomSqlValue>): string | null {
    const json = text(row, 'json')
    const checksum = text(row, 'checksum')
    if (integer(row, 'sequence') !== this.#sequence + 1) return 'out of sequence'
    if (sha256Hex(json) !== checksum) return 'not its checksum'
    const chain = chainOf(this.#chain, checksum)
    if (text(row, 'chain') !== chain) return 'off the chain'
    let writes: RoomWrite[]
    try {
      writes = JSON.parse(json) as RoomWrite[]
      if (!Array.isArray(writes)) return 'not a write set'
    } catch {
      return 'not JSON'
    }
    const documentWrites: EncounterStoreWrite[] = []
    const recordWrites: RecordWrite[] = []
    for (const write of writes)
      if (write.op === 'RECORD_SET' || write.op === 'RECORD_DELETE') recordWrites.push(write)
      else documentWrites.push(write)
    this.#memory.transaction.begin()
    try {
      this.#memory.apply(documentWrites, { validate: false })
      this.#memory.transaction.commit()
    } catch {
      this.#memory.transaction.abort()
      return 'not applicable to the state'
    }
    for (const write of recordWrites)
      if (write.op === 'RECORD_SET')
        this.#records.set(recordId(write.record.kind, write.record.key), write.record)
      else this.#records.delete(recordId(write.kind, write.key))
    this.#sequence += 1
    this.#chain = chain
    return null
  }
}
