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
import {
  liveSessionCheckpointAcknowledgementSchema,
  liveSessionCheckpointJournalInputSchema,
  liveSessionCheckpointJournalEntrySchema,
  type LiveSessionCheckpointAcknowledgement,
  type LiveSessionCheckpointJournalInput,
  type LiveSessionCheckpointJournalEntry,
  type LiveSessionCheckpointJournalResult
} from '@artificer-toolkit/schema/api/liveSessionCheckpointJournal'
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

/** The room's records as a reader sees them: a transaction's staged view, or the committed store. */
export interface RoomRecordReader {
  /** The record as this reader sees it, staged changes included. */
  record(kind: string, key: string): RoomRecord | null
  records(kind: string): RoomRecord[]
}

/** What a command's work may do beyond the store: restore Convex documents and change records. */
export interface RoomTransaction extends RoomRecordReader {
  /** Inserts a document with its Convex identity and creation time. */
  restoreDocument(document: RoomDocument): void
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
    /[\u007f-\uffff]/g,
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
 * Rehydration applies rows in order; an invalid row anywhere, or a broken snapshot, leaves the
 * store empty and reports {@link RoomStoreCorruptError} as `corruption`, retaining durable rows.
 * Compaction folds the log into a new snapshot generation atomically.
 */
export class RoomEncounterStore {
  /** Reads pass through; writes are refused outside {@link transact}. */
  readonly store: EncounterStore

  readonly #storage: RoomStorage
  readonly #onCommitted: (() => void) | undefined
  #memory: Memory = createMemoryEncounterStore({ idPrefix: 'room' })
  #records = new Map<string, RoomRecord>()
  #epoch: string | null = null
  #generation = 0
  #snapshotSequence = 0
  #snapshotChain = EMPTY_CHAIN
  #sequence = 0
  #chain = EMPTY_CHAIN
  #open = false
  #corruption: RoomStoreCorruptError | null = null
  #rowsRead = 0
  #rowsWritten = 0

  constructor(
    storage: RoomStorage,
    /** Runs after every transaction that wrote, once its state is the committed state. */
    onCommitted?: () => void
  ) {
    this.#storage = storage
    this.#onCommitted = onCommitted
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

  /** Detects missing terminal log rows using the authority head committed beside every write set. */
  assertAuthorityHead(head: LiveSessionCheckpointAcknowledgement) {
    this.#assertClosed()
    const expected = liveSessionCheckpointAcknowledgementSchema.parse(head)
    if (this.#corruption) throw this.#corruption
    if (
      this.#epoch !== expected.epoch ||
      this.#sequence !== expected.sequence ||
      this.#chain !== expected.checksum
    ) {
      const corruption = new RoomStoreCorruptError(
        'the durable authority head does not match its journal'
      )
      this.#discard(corruption)
      throw corruption
    }
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

  /** Reads a consecutive committed prefix; compaction explicitly retires earlier ranges. */
  committedWriteSets(input: LiveSessionCheckpointJournalInput): LiveSessionCheckpointJournalResult {
    this.#assertClosed()
    if (this.#corruption) throw this.#corruption
    const { epoch, fromSequence, fromChecksum, toSequence, maxEntries, maxBytes } =
      liveSessionCheckpointJournalInputSchema.parse(input)
    if (epoch !== this.#requireEpoch()) throw new Error('The room journal epoch does not match.')
    if (fromSequence < this.#snapshotSequence)
      throw new Error('The requested room journal range has been compacted.')
    if (toSequence < fromSequence || toSequence > this.#sequence)
      throw new Error('The requested room journal range is outside the committed sequence.')

    let anchor = this.#snapshotChain
    if (fromSequence > this.#snapshotSequence) {
      const [row] = this.#exec(
        'SELECT sequence, json, checksum, chain FROM room_writeset_log WHERE sequence = ?',
        fromSequence
      )
      if (!row || integer(row, 'sequence') !== fromSequence)
        throw new RoomStoreCorruptError(`missing journal anchor ${fromSequence}`)
      anchor = text(row, 'chain')
    }
    if (fromChecksum !== anchor)
      throw new Error('The room journal starting checksum does not match.')

    const entries: LiveSessionCheckpointJournalEntry[] = []
    let sequence = fromSequence
    let checksum = fromChecksum
    let bytes = 2 // The serialized entries array's brackets.
    while (sequence < toSequence && entries.length < maxEntries) {
      const [row] = this.#exec(
        'SELECT sequence, json, checksum, chain FROM room_writeset_log WHERE sequence = ?',
        sequence + 1
      )
      if (!row || integer(row, 'sequence') !== sequence + 1)
        throw new RoomStoreCorruptError(`missing journal row ${sequence + 1}`)
      const entry = {
        sequence: integer(row, 'sequence'),
        writeSetJson: text(row, 'json'),
        writeSetChecksum: text(row, 'checksum'),
        chainChecksum: text(row, 'chain')
      }
      if (
        !liveSessionCheckpointJournalEntrySchema.safeParse(entry).success ||
        sha256Hex(entry.writeSetJson) !== entry.writeSetChecksum ||
        chainOf(checksum, entry.writeSetChecksum) !== entry.chainChecksum
      )
        throw new RoomStoreCorruptError(
          `journal row ${entry.sequence} failed its checksum or chain`
        )
      try {
        if (!Array.isArray(JSON.parse(entry.writeSetJson))) throw new Error('not an array')
      } catch {
        throw new RoomStoreCorruptError(
          `journal row ${entry.sequence} is not a JSON write-set array`
        )
      }
      const entryBytes =
        new TextEncoder().encode(JSON.stringify(entry)).byteLength + (entries.length === 0 ? 0 : 1)
      if (bytes + entryBytes > maxBytes) {
        if (entries.length === 0) throw new Error('The next room journal entry exceeds maxBytes.')
        break
      }
      entries.push(entry)
      bytes += entryBytes
      sequence = entry.sequence
      checksum = entry.chainChecksum
    }
    return {
      entries,
      toSequence: sequence,
      toChecksum: checksum,
      complete: sequence === toSequence
    }
  }

  /**
   * Loads a Convex-read aggregate as a new snapshot generation, replacing everything (a new epoch
   * or a store found corrupt). Documents are validated; nothing changes if any is invalid.
   */
  hydrate({
    epoch,
    documents,
    records,
    checkpoint,
    commitDurable
  }: {
    epoch: string
    documents: readonly RoomDocument[]
    records: readonly RoomRecord[]
    checkpoint?: LiveSessionCheckpointAcknowledgement
    commitDurable?: () => undefined
  }) {
    this.#assertClosed()
    const base = checkpoint && liveSessionCheckpointAcknowledgementSchema.parse(checkpoint)
    if (base && base.epoch !== epoch) throw new Error('The room snapshot authority epoch is stale.')
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
    const chain = base?.checksum ?? sha256Hex(`room-store:genesis:${sha256Hex(serialized)}`)
    const sequence = base?.sequence ?? 0
    this.#persistSnapshot({ epoch, sequence, chain, serialized, replaceLog: true, commitDurable })
    this.#memory = memory
    this.#records = recordMap
    this.#epoch = epoch
    this.#snapshotSequence = sequence
    this.#snapshotChain = chain
    this.#sequence = sequence
    this.#chain = chain
    this.#corruption = null
  }

  /**
   * Runs one command's writes as an all-or-nothing overlay. If `work` throws or the write set
   * cannot be logged, every change is discarded; otherwise one log row is committed and the change
   * becomes the new state. `commitDurable` writes the command receipt and authority head inside that
   * same SQLite transaction. Without it, a command that changes nothing writes no row.
   */
  async transact<Result>(
    work: (transaction: RoomTransaction) => Promise<Result>,
    commitDurable?: (entry: LiveSessionCheckpointJournalEntry) => undefined
  ): Promise<Result> {
    this.#assertClosed()
    this.#open = true
    this.#memory.transaction.begin()
    // Each record logs only its net change: a checkpoint sees a row set twice in one command once.
    const staged = new Map<string, RecordWrite>()
    const transaction: RoomTransaction = {
      restoreDocument: ({ table, id, creationTime, fields }) => {
        if (!isTable(table)) throw new Error(`Unknown room table ${table}.`)
        this.#memory.apply([{ op: 'RESTORE', table, id, creationTime, fields }])
      },
      record: (kind, key) => {
        const id = recordId(kind, key)
        const write = staged.get(id)
        const record = write
          ? write.op === 'RECORD_SET'
            ? write.record
            : null
          : this.#records.get(id)
        return record ? { ...record } : null
      },
      records: (kind) => {
        const records = new Map(this.#records)
        for (const [id, write] of staged) {
          if (write.op === 'RECORD_SET') records.set(id, write.record)
          else records.delete(id)
        }
        return [...records.values()]
          .filter((record) => record.kind === kind)
          .map((record) => ({ ...record }))
      },
      setRecord: (record) => {
        staged.set(recordId(record.kind, record.key), { op: 'RECORD_SET', record: { ...record } })
      },
      deleteRecord: (kind, key) => {
        const id = recordId(kind, key)
        if (this.#records.has(id)) staged.set(id, { op: 'RECORD_DELETE', kind, key })
        else staged.delete(id)
      }
    }
    try {
      const result = await work(transaction)
      const writes: RoomWrite[] = [...this.#memory.transaction.writes(), ...staged.values()]
      if (writes.length > 0 || commitDurable) this.#logWrites(writes, commitDurable)
      this.#memory.transaction.commit()
      for (const [id, write] of staged)
        if (write.op === 'RECORD_SET') this.#records.set(id, write.record)
        else this.#records.delete(id)
      if (writes.length > 0) this.#onCommitted?.()
      return result
    } catch (error) {
      this.#memory.transaction.abort()
      throw error
    } finally {
      this.#open = false
    }
  }

  /**
   * Retires only the acknowledged prefix. Later committed rows and live state remain unchanged;
   * the acknowledged snapshot and prefix deletion commit in one SQLite transaction.
   */
  compact(input: LiveSessionCheckpointAcknowledgement, commitDurable?: () => undefined) {
    this.#assertClosed()
    if (this.#corruption) throw this.#corruption
    const acknowledgement = liveSessionCheckpointAcknowledgementSchema.parse(input)
    const { epoch, sequence, checksum } = acknowledgement
    if (epoch !== this.#requireEpoch()) throw new Error('The room checkpoint epoch does not match.')
    if (sequence < this.#snapshotSequence || sequence > this.#sequence)
      throw new Error('The room checkpoint is outside the retained committed sequence.')
    const base = this.#checkpointBase()
    const memory = this.#snapshotMemory(base.content)
    const records = new Map(
      base.content.records.map((record) => [recordId(record.kind, record.key), record])
    )
    let cursor = base.sequence
    let chain = base.checksum
    let serialized = sequence === cursor ? asciiJson(base.content) : ''
    let acknowledgedChain = chain
    while (cursor < this.#sequence) {
      const page = this.committedWriteSets({
        epoch,
        fromSequence: cursor,
        fromChecksum: chain,
        toSequence: this.#sequence,
        maxEntries: 100,
        maxBytes: 4 * 1024 * 1024
      })
      for (const entry of page.entries) {
        const failure = this.#applyWrites(
          memory,
          records,
          JSON.parse(entry.writeSetJson) as RoomWrite[]
        )
        if (failure) throw new RoomStoreCorruptError(`log row ${entry.sequence} is ${failure}`)
        if (entry.sequence === sequence) {
          serialized = asciiJson(this.#content(memory, records))
          acknowledgedChain = entry.chainChecksum
        }
      }
      cursor = page.toSequence
      chain = page.toChecksum
    }
    if (chain !== this.#chain)
      throw new RoomStoreCorruptError('the journal no longer matches the room checksum')
    if (checksum !== acknowledgedChain)
      throw new Error('The room checkpoint checksum does not match.')
    if (sequence === this.#snapshotSequence) {
      if (commitDurable) this.#storage.transactionSync(commitDurable)
      return
    }
    this.#persistSnapshot({
      epoch,
      sequence,
      chain: checksum,
      serialized,
      commitDurable
    })
    this.#snapshotSequence = sequence
    this.#snapshotChain = checksum
  }

  /** The durable base to which the retained committed journal applies. */
  checkpointSnapshot() {
    const { epoch, sequence, checksum, content } = this.#checkpointBase()
    const documents: RoomDocument[] = []
    for (const table of TABLES)
      for (const { _id, _creationTime, ...fields } of content.documents[table] ?? [])
        documents.push({ table, id: _id, creationTime: _creationTime, fields })
    return {
      epoch,
      sequence,
      checksum,
      documents,
      records: content.records.map((record) => ({ ...record }))
    }
  }

  #checkpointBase() {
    this.#assertClosed()
    if (this.#corruption) throw this.#corruption
    const chunks = this.#exec(
      `SELECT generation, part, part_count, epoch, sequence, chain, content_checksum, content
       FROM room_snapshot_chunks
       WHERE generation = (SELECT MAX(generation) FROM room_snapshot_chunks)
       ORDER BY part`
    )
    const { first, content } = this.#readSnapshotContent(chunks)
    const epoch = text(first, 'epoch')
    const sequence = integer(first, 'sequence')
    const checksum = text(first, 'chain')
    if (
      epoch !== this.#requireEpoch() ||
      sequence !== this.#snapshotSequence ||
      checksum !== this.#snapshotChain
    )
      throw new RoomStoreCorruptError('the checkpoint snapshot no longer matches the room')
    return { epoch, sequence, checksum, content }
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
    serialized,
    replaceLog = false,
    commitDurable
  }: {
    epoch: string
    sequence: number
    chain: string
    serialized: string
    replaceLog?: boolean
    commitDurable?: () => undefined
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
      if (replaceLog) this.#exec('DELETE FROM room_writeset_log')
      else this.#exec('DELETE FROM room_writeset_log WHERE sequence <= ?', sequence)
      commitDurable?.()
    })
    this.#generation = generation
  }

  #logWrites(
    writes: readonly RoomWrite[],
    commitDurable?: (entry: LiveSessionCheckpointJournalEntry) => undefined
  ) {
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
      commitDurable?.({
        sequence,
        writeSetJson: json,
        writeSetChecksum: checksum,
        chainChecksum: chain
      })
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
    this.#snapshotChain = EMPTY_CHAIN
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
    for (const row of rows) {
      const failure = this.#replayRow(row)
      if (failure)
        throw new RoomStoreCorruptError(`log row ${String(row['sequence'])} is ${failure}`)
    }
  }

  #readSnapshotContent(chunks: Record<string, RoomSqlValue>[]) {
    const [first] = chunks
    if (!first) throw new RoomStoreCorruptError('the snapshot is missing')
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
    return { first, content }
  }

  #loadSnapshot(chunks: Record<string, RoomSqlValue>[]) {
    const { first, content } = this.#readSnapshotContent(chunks)
    this.#memory = this.#snapshotMemory(content)
    this.#records = new Map(
      content.records.map((record) => [recordId(record.kind, record.key), record])
    )
    this.#generation = integer(first!, 'generation')
    this.#epoch = text(first!, 'epoch')
    this.#snapshotSequence = integer(first!, 'sequence')
    this.#sequence = this.#snapshotSequence
    this.#chain = text(first!, 'chain')
    this.#snapshotChain = this.#chain
  }

  #snapshotMemory(content: SnapshotContent) {
    const memory = createMemoryEncounterStore({ idPrefix: 'room' })
    for (const table of TABLES) {
      const documents = content.documents[table]
      if (documents) loadTable(memory, table, documents, false)
    }
    memory.restoreCounters(content.counters)
    return memory
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
    const failure = this.#applyWrites(this.#memory, this.#records, writes)
    if (failure) return failure
    this.#sequence += 1
    this.#chain = chain
    return null
  }

  #applyWrites(
    memory: Memory,
    records: Map<string, RoomRecord>,
    writes: RoomWrite[]
  ): string | null {
    const documentWrites: EncounterStoreWrite[] = []
    const recordWrites: RecordWrite[] = []
    for (const write of writes)
      if (write.op === 'RECORD_SET' || write.op === 'RECORD_DELETE') recordWrites.push(write)
      else documentWrites.push(write)
    memory.transaction.begin()
    try {
      memory.apply(documentWrites, { validate: false })
      memory.transaction.commit()
    } catch {
      memory.transaction.abort()
      return 'not applicable to the state'
    }
    for (const write of recordWrites)
      if (write.op === 'RECORD_SET')
        records.set(recordId(write.record.kind, write.record.key), write.record)
      else records.delete(recordId(write.kind, write.key))
    return null
  }
}
