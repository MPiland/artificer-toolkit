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
import { createDerivationScope } from '@artificer-toolkit/encounter-persistence/transactionReads'
import {
  LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES,
  liveSessionCheckpointAcknowledgementSchema,
  liveSessionCheckpointJournalInputSchema,
  liveSessionCheckpointJournalEntrySchema,
  type LiveSessionCheckpointAcknowledgement,
  type LiveSessionCheckpointJournalInput,
  type LiveSessionCheckpointJournalEntry,
  type LiveSessionCheckpointJournalResult
} from '@artificer-toolkit/schema/api/liveSessionCheckpointJournal'
import { LIVE_SESSION_CHECKPOINT_MAX_BYTES } from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import { assertDamageMirrorsSettled } from './roomDamageMirrorCollector.js'

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
  documents: Partial<Record<EncounterTableName, EncounterDocument<EncounterTableName>[]>>
  records: RoomRecord[]
}

/** A snapshot page holds one table's documents or the room's records, never both. */
type PageGroup = EncounterTableName | 'records'

/** What the store knows of a stored page: its entities (document ids, record ids) and last text length. */
interface SnapshotPage {
  group: PageGroup
  keys: Set<string>
  length: number
}

interface PageRewrite {
  page: SnapshotPage
  text: string
}

/** The pages one compaction rewrites (null: delete) and the entities that moved, before it commits. */
interface PagePlan {
  rewrites: Map<number, PageRewrite | null>
  pageOf: Map<string, number | null>
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
  /**
   * The record's JSON object, parsed once per stored record and served deeply frozen, so its
   * `deriveOnce` derivations last as long as the record is unchanged. Callers must not mutate it.
   */
  recordValue(kind: string, key: string): object | null
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

/** One command's writes exceed one atomic checkpoint; the command is aborted, never split. */
export class RoomWriteSetTooLargeError extends Error {
  constructor(size: number) {
    super(`Room command write set of ${size} characters exceeds one checkpoint.`)
    this.name = 'RoomWriteSetTooLargeError'
  }
}

/**
 * A statement's bound text stays under Durable Object SQLite's 100 KB statement limit. It is also
 * the size a snapshot page is packed to, so a page is one row unless a single document exceeds it.
 */
const SNAPSHOT_CHUNK_CHARS = 96_000
/**
 * A command's checkpoint records are deltas of its writes plus a key and two checksums each, so the
 * quarter left over lets any admitted command publish alone. The JSON is ASCII: characters are bytes.
 */
const MAX_WRITE_SET_CHARS = (LIVE_SESSION_CHECKPOINT_MAX_BYTES * 3) / 4
const TABLES = Object.keys(encounterStoreSchemas) as EncounterTableName[]
const EMPTY_CHAIN = sha256Hex('room-store:empty')

/** JSON with every non-ASCII character escaped, so a string's length is its byte length. */
function asciiJson(value: unknown) {
  return JSON.stringify(value).replace(
    /[\u007f-\uffff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
}

/** The room reads its own documents on every command and push, so their derivations persist. */
const createRoomMemory = () => createMemoryEncounterStore({ idPrefix: 'room', sharedReads: true })
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

const sortedRecords = (records: Iterable<RoomRecord>) =>
  [...records].sort(
    (left, right) =>
      left.kind.localeCompare(right.kind, 'en') || left.key.localeCompare(right.key, 'en')
  )

const CHAT_ENTRY_TABLE = 'campaignConversationEntries' satisfies EncounterTableName

/** New chat entries and roll cards (D69): one header insert each. */
const countChatEntries = (writes: readonly RoomWrite[]) =>
  writes.filter((write) => write.op === 'INSERT' && write.table === CHAT_ENTRY_TABLE).length

/**
 * The record kind of Scene command evidence (geometry saves and command receipts). It stays in the
 * room and never reaches Convex (ADR 0035 Amendment 26), so the checkpoint builder ignores it. It is
 * a record, never a chat entry, so `unsavedChatEntries` does not count it.
 */
export const SCENE_EVIDENCE_ROW = 'SCENE_EVIDENCE_ROW'

function partitionWrites(writes: readonly RoomWrite[]) {
  const documentWrites: EncounterStoreWrite[] = []
  const recordWrites: RecordWrite[] = []
  for (const write of writes)
    if (write.op === 'RECORD_SET' || write.op === 'RECORD_DELETE') recordWrites.push(write)
    else documentWrites.push(write)
  return { documentWrites, recordWrites }
}

const pageText = (group: PageGroup, entityJson: readonly string[]) =>
  `${group === 'records' ? '{"records":[' : `{"table":"${group}","documents":[`}${entityJson.join(',')}]}`

/**
 * Greedily packs serialized entities, in order, into pages whose text stays within one chunk; one
 * entity larger than a chunk is a page of its own.
 */
function packPages(group: PageGroup, entities: readonly { key: string; json: string }[]) {
  const empty = pageText(group, []).length
  const pages: { keys: string[]; text: string }[] = []
  let keys: string[] = []
  let items: string[] = []
  let length = empty
  for (const { key, json } of entities) {
    if (keys.length > 0 && length + 1 + json.length > SNAPSHOT_CHUNK_CHARS) {
      pages.push({ keys, text: pageText(group, items) })
      keys = []
      items = []
      length = empty
    }
    keys.push(key)
    items.push(json)
    length += json.length + (keys.length > 1 ? 1 : 0)
  }
  if (keys.length > 0) pages.push({ keys, text: pageText(group, items) })
  return pages
}

/** Packs a whole snapshot into freshly numbered pages. */
function packSnapshot(content: SnapshotContent) {
  const pages = new Map<number, PageRewrite>()
  const add = (group: PageGroup, entities: { key: string; json: string }[]) => {
    for (const { keys, text } of packPages(group, entities))
      pages.set(pages.size + 1, { page: { group, keys: new Set(keys), length: text.length }, text })
  }
  for (const table of TABLES)
    add(
      table,
      (content.documents[table] ?? []).map((document) => ({
        key: document._id,
        json: asciiJson(document)
      }))
    )
  add(
    'records',
    content.records.map((record) => ({
      key: recordId(record.kind, record.key),
      json: asciiJson(record)
    }))
  )
  return pages
}

/** Parses checksummed stored JSON; a failure means the store was altered. */
function parseStored(json: string, what: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    throw new RoomStoreCorruptError(`${what} is not JSON`)
  }
}

function loadTable(
  memory: Memory,
  table: EncounterTableName,
  documents: readonly { _id: string; _creationTime: number }[],
  validate: boolean
) {
  // One generic loader serves every table; the caller has matched each document to its table.
  memory.load(table, documents as EncounterDocument<typeof table>[], { validate })
}

/**
 * The room's authoritative Encounter store (ADR 0035): the Run aggregate lives in memory and is
 * persisted in Durable Object SQLite as a paged snapshot (`room_snapshot_head`, `room_snapshot_pages`)
 * plus a log with one row per command's write set (`room_writeset_log`). A page holds one table's
 * documents or the room's records, split into parts only when one document exceeds a statement.
 * The state checksum is a chain over the write sets,
 * `H(previous || write set checksum)`, so two rooms holding the same commands hold the same checksum.
 *
 * Durability: a command commits with a single SQLite transaction that inserts one log row, and
 * the in-memory aggregate follows only after that succeeds. A crash or eviction before it loses the
 * command completely (its memory was never durable); after it, the row alone reproduces the command.
 * Rehydration applies rows in order; an invalid row anywhere, or a broken snapshot, leaves the
 * store empty and reports {@link RoomStoreCorruptError} as `corruption`, retaining durable rows.
 * Compaction folds the acknowledged log prefix into the pages it touched, atomically, so its cost
 * follows what the prefix changed rather than the size of the snapshot.
 */
export class RoomEncounterStore {
  /** Reads pass through; writes are refused outside {@link transact}. */
  readonly store: EncounterStore

  readonly #storage: RoomStorage
  readonly #onCommitted: (() => void) | undefined
  readonly #journalUnowned: ((entry: LiveSessionCheckpointJournalEntry) => undefined) | undefined
  #memory: Memory = createRoomMemory()
  #records = new Map<string, RoomRecord>()
  /** Parsed record values by stored record; a record is replaced, never changed, when it changes. */
  readonly #recordValues = new WeakMap<RoomRecord, object>()
  readonly #recordDerivations = createDerivationScope()
  #epoch: string | null = null
  /**
   * The acknowledged snapshot this store wrote or loaded, kept so each checkpoint and compaction
   * skips re-reading it; compaction advances it in place with the acknowledged prefix.
   */
  #base: Memory = createRoomMemory()
  #baseRecords = new Map<string, RoomRecord>()
  /** The snapshot page each stored entity is on, and what each page holds. */
  #pageOf = new Map<string, number>()
  #pages = new Map<number, SnapshotPage>()
  #snapshotSequence = 0
  #snapshotChain = EMPTY_CHAIN
  #sequence = 0
  #chain = EMPTY_CHAIN
  #open = false
  #closed: { promise: Promise<void>; resolve: () => void } | null = null
  #corruption: RoomStoreCorruptError | null = null
  #rowsRead = 0
  #rowsWritten = 0
  /** New chat entries and roll cards in the log beyond the acknowledged snapshot (see `unsavedChatEntries`). */
  #unsavedChatEntries = 0

  constructor(
    storage: RoomStorage,
    /** Runs after every transaction that wrote, once its state is the committed state. */
    onCommitted?: () => void,
    /**
     * Records the authority head for a write set committed without its own `commitDurable`, such as
     * an input reload during a read, inside the same SQLite transaction as its log row.
     */
    journalUnowned?: (entry: LiveSessionCheckpointJournalEntry) => undefined
  ) {
    this.#storage = storage
    this.#onCommitted = onCommitted
    this.#journalUnowned = journalUnowned
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
    this.#exec(`CREATE TABLE IF NOT EXISTS room_snapshot_head (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      epoch TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      chain TEXT NOT NULL,
      counters TEXT NOT NULL,
      page_count INTEGER NOT NULL
    )`)
    this.#exec(`CREATE TABLE IF NOT EXISTS room_snapshot_pages (
      page INTEGER NOT NULL,
      part INTEGER NOT NULL,
      part_count INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      content TEXT NOT NULL,
      PRIMARY KEY (page, part)
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

  /**
   * The new chat entries and roll cards the next checkpoint would carry, maintained per commit,
   * replay and compaction so reading it scans nothing. Only chat is counted: the journal's size is
   * not a save trigger, because a checkpoint pages itself and coalesces the log's write sets.
   */
  get unsavedChatEntries() {
    return this.#unsavedChatEntries
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

  recordValue(kind: string, key: string) {
    return this.#valueOf(this.#records.get(recordId(kind, key)))
  }

  #valueOf(record: RoomRecord | undefined | null) {
    if (!record) return null
    let value = this.#recordValues.get(record)
    if (!value) {
      const parsed: unknown = JSON.parse(record.json)
      if (typeof parsed !== 'object' || parsed === null)
        throw new Error(`Room record ${record.kind} is not a JSON object.`)
      value = this.#recordDerivations.serve(parsed)
      this.#recordValues.set(record, value)
    }
    return value
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
   * Loads a Convex-read aggregate as a fresh snapshot, replacing everything (a new epoch
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
    const memory = createRoomMemory()
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
    const chain = base?.checksum ?? sha256Hex(`room-store:genesis:${sha256Hex(asciiJson(content))}`)
    const sequence = base?.sequence ?? 0
    const pages = packSnapshot(content)
    this.#storage.transactionSync(() => {
      this.#exec('DELETE FROM room_snapshot_head')
      this.#exec('DELETE FROM room_snapshot_pages')
      for (const [id, { text }] of pages) this.#writePage(id, text)
      this.#writeHead(epoch, sequence, chain, content.counters, pages.size)
      this.#exec('DELETE FROM room_writeset_log')
      commitDurable?.()
    })
    this.#unsavedChatEntries = 0
    this.#memory = memory
    this.#records = recordMap
    this.#base = this.#snapshotMemory(content)
    this.#baseRecords = new Map(recordMap)
    this.#pages = new Map([...pages].map(([id, { page }]) => [id, page]))
    this.#pageOf = new Map(
      [...pages].flatMap(([id, { page }]) =>
        [...page.keys].map((key): [string, number] => [key, id])
      )
    )
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
    const stagedRecord = (kind: string, key: string) => {
      const id = recordId(kind, key)
      const write = staged.get(id)
      return write ? (write.op === 'RECORD_SET' ? write.record : null) : this.#records.get(id)
    }
    const transaction: RoomTransaction = {
      restoreDocument: ({ table, id, creationTime, fields }) => {
        if (!isTable(table)) throw new Error(`Unknown room table ${table}.`)
        this.#memory.apply([{ op: 'RESTORE', table, id, creationTime, fields }])
      },
      record: (kind, key) => {
        const record = stagedRecord(kind, key)
        return record ? { ...record } : null
      },
      recordValue: (kind, key) => this.#valueOf(stagedRecord(kind, key)),
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
      assertDamageMirrorsSettled(transaction)
      const writes: RoomWrite[] = [...this.#memory.transaction.writes(), ...staged.values()]
      if (writes.length > 0 || commitDurable)
        this.#logWrites(writes, commitDurable ?? this.#journalUnowned)
      this.#memory.transaction.commit()
      for (const [id, write] of staged)
        if (write.op === 'RECORD_SET') this.#records.set(id, write.record)
        else this.#records.delete(id)
      this.#recordDerivations.renew()
      if (writes.length > 0) this.#onCommitted?.()
      return result
    } catch (error) {
      this.#memory.transaction.abort()
      throw error
    } finally {
      this.#open = false
      this.#closed?.resolve()
      this.#closed = null
    }
  }

  /**
   * Runs `run` once no command transaction is open. A command holds its transaction across Convex
   * reads, so work started outside the command chain, such as a deadline flush, waits here; `run`
   * starts in the same turn the store is seen closed, so no transaction opens before it.
   */
  async whenClosed<Result>(run: () => Result): Promise<Result> {
    while (this.#open) {
      if (!this.#closed) {
        let resolve!: () => void
        const promise = new Promise<void>((settle) => (resolve = settle))
        this.#closed = { promise, resolve }
      }
      await this.#closed.promise
    }
    return run()
  }

  /**
   * Retires only the acknowledged prefix. Later committed rows and live state remain unchanged;
   * the prefix is folded into the acknowledged base, and only the snapshot pages it touched are
   * rewritten, in one SQLite transaction with the head and the prefix deletion.
   */
  compact(input: LiveSessionCheckpointAcknowledgement, commitDurable?: () => undefined) {
    this.#assertClosed()
    if (this.#corruption) throw this.#corruption
    const acknowledgement = liveSessionCheckpointAcknowledgementSchema.parse(input)
    const { epoch, sequence, checksum } = acknowledgement
    if (epoch !== this.#requireEpoch()) throw new Error('The room checkpoint epoch does not match.')
    if (sequence < this.#snapshotSequence || sequence > this.#sequence)
      throw new Error('The room checkpoint is outside the retained committed sequence.')
    if (sequence === this.#snapshotSequence) {
      if (checksum !== this.#snapshotChain)
        throw new Error('The room checkpoint checksum does not match.')
      if (commitDurable) this.#storage.transactionSync(commitDurable)
      return
    }
    const recordChanges = new Map<string, RoomRecord | null>()
    let plan: PagePlan
    let retiredChatEntries = 0
    this.#base.transaction.begin()
    try {
      // Only the acknowledged prefix is replayed; later rows are verified when they are acknowledged
      // or rehydrated, so draining a backlog stays linear in its size.
      let cursor = this.#snapshotSequence
      let chain = this.#snapshotChain
      while (cursor < sequence) {
        const page = this.committedWriteSets({
          epoch,
          fromSequence: cursor,
          fromChecksum: chain,
          toSequence: sequence,
          maxEntries: 100,
          maxBytes: LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES
        })
        for (const entry of page.entries) {
          const writes = JSON.parse(entry.writeSetJson) as RoomWrite[]
          const { documentWrites, recordWrites } = partitionWrites(writes)
          try {
            this.#base.apply(documentWrites, { validate: false })
          } catch {
            throw new RoomStoreCorruptError(
              `log row ${entry.sequence} is not applicable to the state`
            )
          }
          retiredChatEntries += countChatEntries(documentWrites)
          for (const write of recordWrites)
            if (write.op === 'RECORD_SET')
              recordChanges.set(recordId(write.record.kind, write.record.key), write.record)
            else recordChanges.set(recordId(write.kind, write.key), null)
        }
        cursor = page.toSequence
        chain = page.toChecksum
      }
      if (checksum !== chain) throw new Error('The room checkpoint checksum does not match.')
      plan = this.#planPages(recordChanges)
      const { rewrites } = plan
      const pageCount = [...rewrites].reduce(
        (count, [id, rewrite]) =>
          count + (this.#pages.has(id) ? (rewrite ? 0 : -1) : rewrite ? 1 : 0),
        this.#pages.size
      )
      this.#storage.transactionSync(() => {
        for (const [id, rewrite] of rewrites) {
          this.#exec('DELETE FROM room_snapshot_pages WHERE page = ?', id)
          if (rewrite) this.#writePage(id, rewrite.text)
        }
        this.#writeHead(epoch, sequence, checksum, this.#base.counters(), pageCount)
        this.#exec('DELETE FROM room_writeset_log WHERE sequence <= ?', sequence)
        commitDurable?.()
      })
    } catch (error) {
      this.#base.transaction.abort()
      throw error
    }
    this.#base.transaction.commit()
    for (const [key, record] of recordChanges)
      if (record) this.#baseRecords.set(key, record)
      else this.#baseRecords.delete(key)
    for (const [key, id] of plan.pageOf)
      if (id === null) this.#pageOf.delete(key)
      else this.#pageOf.set(key, id)
    for (const [id, rewrite] of plan.rewrites)
      if (rewrite) this.#pages.set(id, rewrite.page)
      else this.#pages.delete(id)
    this.#snapshotSequence = sequence
    this.#snapshotChain = checksum
    this.#unsavedChatEntries -= retiredChatEntries
  }

  /** The durable base to which the retained committed journal applies. */
  checkpointSnapshot() {
    this.#assertClosed()
    if (this.#corruption) throw this.#corruption
    const epoch = this.#requireEpoch()
    const documents: RoomDocument[] = []
    for (const table of TABLES)
      for (const { _id, _creationTime, ...fields } of this.#base.documents(table))
        documents.push({ table, id: _id, creationTime: _creationTime, fields })
    return {
      epoch,
      sequence: this.#snapshotSequence,
      checksum: this.#snapshotChain,
      documents,
      records: sortedRecords(this.#baseRecords.values()).map((record) => ({ ...record }))
    }
  }

  /**
   * Plans the page rewrites for the writes of the open base transaction: new entities are placed,
   * and a page that outgrew a chunk is split. Nothing is stored until the plan commits.
   */
  #planPages(recordChanges: ReadonlyMap<string, RoomRecord | null>): PagePlan {
    const dirty = new Map<number, SnapshotPage>()
    const pageOf = new Map<string, number | null>()
    let nextPage = Math.max(0, ...this.#pages.keys()) + 1
    const edit = (id: number) => {
      const edited = dirty.get(id)
      if (edited) return edited
      const stored = this.#pages.get(id)
      if (!stored) throw new RoomStoreCorruptError(`snapshot page ${id} is missing`)
      const copy = { group: stored.group, keys: new Set(stored.keys), length: stored.length }
      dirty.set(id, copy)
      return copy
    }
    const place = (group: PageGroup, key: string) => {
      let newest: { id: number; page: SnapshotPage } | undefined
      for (const [id, page] of new Map([...this.#pages, ...dirty]))
        if (page.group === group && (!newest || id > newest.id)) newest = { id, page }
      let id = newest && newest.page.length < SNAPSHOT_CHUNK_CHARS ? newest.id : undefined
      if (id === undefined) {
        id = nextPage++
        dirty.set(id, { group, keys: new Set(), length: 0 })
      }
      edit(id).keys.add(key)
      pageOf.set(key, id)
    }

    const tables = new Map<string, EncounterTableName | undefined>()
    for (const write of this.#base.transaction.writes())
      tables.set(
        write.id,
        write.op === 'INSERT' || write.op === 'RESTORE' ? write.table : tables.get(write.id)
      )
    const changes = [
      ...[...tables].map(([key, group]) => ({
        key,
        group,
        exists: this.#base.document(key) !== null
      })),
      ...[...recordChanges].map(([key, record]) => ({
        key,
        group: 'records' as const,
        exists: record !== null
      }))
    ]
    for (const { key, group, exists } of changes) {
      const id = this.#pageOf.get(key)
      if (id === undefined) {
        if (!exists) continue
        if (!group) throw new RoomStoreCorruptError('a stored document has no snapshot page')
        place(group, key)
      } else if (exists) edit(id)
      else {
        edit(id).keys.delete(key)
        pageOf.set(key, null)
      }
    }

    const entityJson = (group: PageGroup, key: string) => {
      const entity =
        group === 'records'
          ? recordChanges.has(key)
            ? recordChanges.get(key)
            : this.#baseRecords.get(key)
          : this.#base.document(key)
      if (!entity) throw new RoomStoreCorruptError(`a ${group} snapshot entity is missing`)
      return asciiJson(entity)
    }
    const rewrites = new Map<number, PageRewrite | null>()
    for (const [id, { group, keys }] of dirty) {
      if (keys.size === 0) {
        rewrites.set(id, null)
        continue
      }
      const packed = packPages(
        group,
        [...keys].map((key) => ({ key, json: entityJson(group, key) }))
      )
      for (const [index, { keys: packedKeys, text }] of packed.entries()) {
        const target = index === 0 ? id : nextPage++
        rewrites.set(target, {
          page: { group, keys: new Set(packedKeys), length: text.length },
          text
        })
        if (index > 0) for (const key of packedKeys) pageOf.set(key, target)
      }
    }
    return { rewrites, pageOf }
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
      if (rows.length > 0) documents[table] = rows
    }
    return {
      counters: memory.counters(),
      documents,
      records: sortedRecords(records.values())
    }
  }

  /** Writes one page's text as parts of at most one chunk; the page's old parts are already gone. */
  #writePage(page: number, pageContent: string) {
    const checksum = sha256Hex(pageContent)
    const parts = Math.max(1, Math.ceil(pageContent.length / SNAPSHOT_CHUNK_CHARS))
    for (let part = 0; part < parts; part++)
      this.#exec(
        `INSERT INTO room_snapshot_pages (page, part, part_count, checksum, content)
          VALUES (?, ?, ?, ?, ?)`,
        page,
        part,
        parts,
        checksum,
        pageContent.slice(part * SNAPSHOT_CHUNK_CHARS, (part + 1) * SNAPSHOT_CHUNK_CHARS)
      )
  }

  #writeHead(
    epoch: string,
    sequence: number,
    chain: string,
    counters: SnapshotContent['counters'],
    pageCount: number
  ) {
    this.#exec(
      `INSERT OR REPLACE INTO room_snapshot_head (singleton, epoch, sequence, chain, counters, page_count)
        VALUES (1, ?, ?, ?, ?, ?)`,
      epoch,
      sequence,
      chain,
      JSON.stringify(counters),
      pageCount
    )
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
    this.#unsavedChatEntries += countChatEntries(writes)
  }

  /** Forgets a store that could not be rebuilt; a hydrate replaces its rows. */
  #discard(corruption: RoomStoreCorruptError) {
    this.#memory = createRoomMemory()
    this.#records = new Map()
    this.#base = createRoomMemory()
    this.#baseRecords = new Map()
    this.#pageOf = new Map()
    this.#pages = new Map()
    this.#epoch = null
    this.#snapshotSequence = 0
    this.#snapshotChain = EMPTY_CHAIN
    this.#sequence = 0
    this.#chain = EMPTY_CHAIN
    this.#unsavedChatEntries = 0
    this.#corruption = corruption
  }

  #recover() {
    const [head] = this.#exec(
      'SELECT epoch, sequence, chain, counters, page_count FROM room_snapshot_head'
    )
    const pageRows = this.#exec(
      'SELECT page, part, part_count, checksum, content FROM room_snapshot_pages ORDER BY page, part'
    )
    const rows = this.#exec(
      'SELECT sequence, json, checksum, chain FROM room_writeset_log ORDER BY sequence'
    )
    if (!head) {
      if (pageRows.length > 0) throw new RoomStoreCorruptError('the snapshot head is missing')
      if (rows.length > 0) throw new RoomStoreCorruptError('a write-set log has no snapshot')
      return
    }
    this.#loadSnapshot(head, pageRows)
    for (const row of rows) {
      const failure = this.#replayRow(row)
      if (failure)
        throw new RoomStoreCorruptError(`log row ${String(row['sequence'])} is ${failure}`)
    }
  }

  /** Loads the live and acknowledged-base memories from the head and every verified page. */
  #loadSnapshot(head: Record<string, RoomSqlValue>, pageRows: Record<string, RoomSqlValue>[]) {
    const live = createRoomMemory()
    const base = createRoomMemory()
    const records = new Map<string, RoomRecord>()
    const pageOf = new Map<string, number>()
    const pages = new Map<number, SnapshotPage>()
    for (let index = 0; index < pageRows.length;) {
      const first = pageRows[index]!
      const page = integer(first, 'page')
      const parts = integer(first, 'part_count')
      const checksum = text(first, 'checksum')
      const partRows = pageRows.slice(index, index + parts)
      if (
        parts < 1 ||
        partRows.length !== parts ||
        partRows.some(
          (row, part) =>
            integer(row, 'page') !== page ||
            integer(row, 'part') !== part ||
            integer(row, 'part_count') !== parts ||
            row['checksum'] !== checksum
        )
      )
        throw new RoomStoreCorruptError(`snapshot page ${page} is incomplete`)
      index += parts
      const serialized = partRows.map((row) => text(row, 'content')).join('')
      if (sha256Hex(serialized) !== checksum)
        throw new RoomStoreCorruptError(`the snapshot checksum of page ${page} does not match`)
      // The checksum covers the text, so a page that parses was written by this store.
      const {
        table,
        documents,
        records: pageRecords
      }: { table?: unknown; documents?: unknown; records?: unknown } = parseStored(
        serialized,
        `snapshot page ${page}`
      ) ?? {}
      let group: PageGroup
      let keys: string[]
      if (typeof table === 'string' && isTable(table) && Array.isArray(documents)) {
        const stored = documents as StoredDocument[]
        loadTable(base, table, stored, false)
        loadTable(live, table, stored, false)
        group = table
        keys = stored.map(({ _id }) => _id)
      } else if (Array.isArray(pageRecords)) {
        group = 'records'
        keys = (pageRecords as RoomRecord[]).map((record) => {
          const id = recordId(record.kind, record.key)
          records.set(id, record)
          return id
        })
      } else throw new RoomStoreCorruptError(`snapshot page ${page} is malformed`)
      for (const key of keys) {
        if (pageOf.has(key))
          throw new RoomStoreCorruptError(`snapshot page ${page} repeats an entity`)
        pageOf.set(key, page)
      }
      pages.set(page, { group, keys: new Set(keys), length: serialized.length })
    }
    // Parts and checksums cover each page; the head's count covers a page that vanished whole.
    if (pages.size !== integer(head, 'page_count'))
      throw new RoomStoreCorruptError('a snapshot page is missing')
    const counters = parseStored(text(head, 'counters'), 'the snapshot counters') as {
      clock?: unknown
      sequence?: unknown
    } | null
    if (typeof counters?.clock !== 'number' || typeof counters.sequence !== 'number')
      throw new RoomStoreCorruptError('the snapshot counters are malformed')
    const restored = { clock: counters.clock, sequence: counters.sequence }
    live.restoreCounters(restored)
    base.restoreCounters(restored)
    this.#memory = live
    this.#records = new Map(records)
    this.#base = base
    this.#baseRecords = records
    this.#pageOf = pageOf
    this.#pages = pages
    this.#epoch = text(head, 'epoch')
    this.#snapshotSequence = integer(head, 'sequence')
    this.#sequence = this.#snapshotSequence
    this.#chain = text(head, 'chain')
    this.#snapshotChain = this.#chain
  }

  #snapshotMemory(content: SnapshotContent) {
    const memory = createRoomMemory()
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
    const failure = this.#applyWrites(writes)
    if (failure) return failure
    this.#sequence += 1
    this.#chain = chain
    this.#unsavedChatEntries += countChatEntries(writes)
    return null
  }

  #applyWrites(writes: RoomWrite[]): string | null {
    const { documentWrites, recordWrites } = partitionWrites(writes)
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
    return null
  }
}
