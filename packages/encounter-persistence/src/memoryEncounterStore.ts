import type { IndexRange } from 'convex/server'
import type {
  EncounterDocument,
  EncounterOrderedQuery,
  EncounterQuery,
  EncounterStore,
  EncounterTableName
} from './store.js'
import { encounterStoreIndexes, encounterStoreSchemas } from './storeTables.js'
import { createDerivationScope } from './transactionReads.js'

type StoredDocument = Record<string, unknown> & { _id: string; _creationTime: number }
type Bound = { field: string; operator: 'eq' | 'gt' | 'gte' | 'lt' | 'lte'; value: unknown }

/** Convex's cross-type value order: a missing field, null, numbers, booleans, strings, arrays, objects. */
function typeRank(value: unknown) {
  if (value === undefined) return 0
  if (value === null) return 1
  if (typeof value === 'bigint') return 2
  if (typeof value === 'number') return 3
  if (typeof value === 'boolean') return 4
  if (typeof value === 'string') return 5
  if (value instanceof ArrayBuffer) return 6
  if (Array.isArray(value)) return 7
  return 8
}

function compareValues(left: unknown, right: unknown): number {
  const rank = typeRank(left) - typeRank(right)
  if (rank !== 0) return Math.sign(rank)
  if (
    (typeof left === 'number' && typeof right === 'number') ||
    (typeof left === 'bigint' && typeof right === 'bigint') ||
    (typeof left === 'string' && typeof right === 'string')
  )
    return left < right ? -1 : +(left > right)
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right)
  if (Array.isArray(left) && Array.isArray(right)) {
    for (let index = 0; index < Math.min(left.length, right.length); index++) {
      const order = compareValues(left[index], right[index])
      if (order !== 0) return order
    }
    return Math.sign(left.length - right.length)
  }
  return 0
}

/** A copy with object fields in key order and no `undefined` fields, as Convex stores documents. */
function withSortedFields<Value>(value: Value): Value {
  if (Array.isArray(value)) return value.map(withSortedFields) as Value
  if (typeof value !== 'object' || value === null || value instanceof ArrayBuffer) return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map((key) => [key, withSortedFields((value as Record<string, unknown>)[key])])
  ) as Value
}

function inRange(document: StoredDocument, { field, operator, value }: Bound) {
  const order = compareValues(document[field], value)
  if (operator === 'eq') return order === 0
  if (operator === 'gt') return order > 0
  if (operator === 'gte') return order >= 0
  if (operator === 'lt') return order < 0
  return order <= 0
}

/** The bounds an index range callback applies; one recorder serves every builder position. */
function recordBounds(range: ((builder: never) => IndexRange) | undefined): Bound[] {
  const bounds: Bound[] = []
  const bound = (operator: Bound['operator']) => (field: string, value: unknown) => {
    bounds.push({ field, operator, value })
    return recorder
  }
  const recorder = {
    eq: bound('eq'),
    gt: bound('gt'),
    gte: bound('gte'),
    lt: bound('lt'),
    lte: bound('lte')
  }
  // The store interface types the builder per index position; this recorder is all of them.
  if (range) (range as (builder: typeof recorder) => unknown)(recorder)
  return bounds
}

function orderedQuery<Document>(read: () => Document[]): EncounterOrderedQuery<Document> {
  return {
    collect: async () => read(),
    take: async (count) => read().slice(0, count),
    first: async () => read()[0] ?? null,
    unique: async () => {
      const documents = read()
      if (documents.length > 1) throw new Error('unique() query returned more than one document.')
      return documents[0] ?? null
    },
    async *[Symbol.asyncIterator]() {
      yield* read()
    }
  }
}

function query<Document>(read: () => Document[]): EncounterQuery<Document> {
  return {
    ...orderedQuery(read),
    order: (order) => orderedQuery(() => (order === 'desc' ? read().reverse() : read()))
  }
}

/**
 * One write a store made, in the order it was made. Replaying a transaction's writes onto a store
 * holding the same documents reproduces its documents, identities and creation times exactly.
 */
export type EncounterStoreWrite =
  | {
      op: 'INSERT' | 'RESTORE'
      table: EncounterTableName
      id: string
      creationTime: number
      fields: Record<string, unknown>
    }
  | { op: 'PATCH'; id: string; fields: Record<string, unknown>; remove: string[] }
  | { op: 'REPLACE'; id: string; fields: Record<string, unknown> }
  | { op: 'DELETE'; id: string }

/**
 * An in-memory Encounter store with Convex's transaction semantics: index order with the
 * creation-time tiebreaker, `unique` refusing duplicates, a private copy on every read, stored
 * schema validation on every write, and `patch` removing fields set to `undefined`. The
 * conformance suite checks the Convex adapter against it.
 *
 * `transaction` records the writes made between `begin` and `commit` (which returns them) or
 * `abort` (which undoes them, including the identities and creation times they consumed); `apply`
 * replays recorded writes. The room's durable store journals each command's writes this way.
 */
/**
 * `sharedReads` serves the stored documents themselves, deeply frozen, instead of copies, so their
 * `deriveOnce` derivations last for as long as each document is unchanged. Callers must not
 * mutate what it reads.
 */
export function createMemoryEncounterStore({
  idPrefix = 'memory',
  sharedReads = false
}: { idPrefix?: string; sharedReads?: boolean } = {}) {
  const derivations = sharedReads ? createDerivationScope() : null
  const served = (document: StoredDocument) =>
    derivations ? derivations.serve(document) : structuredClone(document)
  const tables = new Map<EncounterTableName, Map<string, StoredDocument>>()
  const tableById = new Map<string, EncounterTableName>()
  let clock = 0
  let sequence = 0
  let validating = true
  let recording: {
    writes: EncounterStoreWrite[]
    undo: Array<() => void>
    clock: number
    sequence: number
  } | null = null

  const rowsOf = (table: EncounterTableName) => {
    let rows = tables.get(table)
    if (!rows) {
      rows = new Map()
      tables.set(table, rows)
    }
    return rows
  }
  const existing = (id: string, operation: string) => {
    const table = tableById.get(id)
    const document = table && tables.get(table)?.get(id)
    if (!table || !document) throw new Error(`${operation} on a nonexistent document ${id}.`)
    return { table, document }
  }
  const write = (table: EncounterTableName, document: StoredDocument) => {
    const { _id, _creationTime, ...fields } = document
    if (validating) encounterStoreSchemas[table].parse(fields)
    const previous = rowsOf(table).get(_id)
    rowsOf(table).set(_id, withSortedFields(document))
    tableById.set(_id, table)
    recording?.undo.push(
      previous
        ? () => rowsOf(table).set(_id, previous)
        : () => {
            rowsOf(table).delete(_id)
            tableById.delete(_id)
          }
    )
  }
  const remove = (id: string) => {
    const { table, document } = existing(id, 'Delete')
    tables.get(table)?.delete(id)
    tableById.delete(id)
    recording?.undo.push(() => {
      rowsOf(table).set(id, document)
      tableById.set(id, table)
    })
  }
  const fieldsOf = ({ _id, _creationTime, ...fields }: StoredDocument) => fields
  const insert = (
    table: EncounterTableName,
    id: string,
    creationTime: number,
    value: Record<string, unknown>
  ) => {
    write(table, { ...value, _id: id, _creationTime: creationTime })
    recording?.writes.push({
      op: 'INSERT',
      table,
      id,
      creationTime,
      fields: fieldsOf(rowsOf(table).get(id)!)
    })
  }
  const patch = (id: string, value: Record<string, unknown>) => {
    const { table, document } = existing(id, 'Patch')
    const next: StoredDocument = { ...document, ...value }
    const removed = Object.keys(value).filter((field) => value[field] === undefined)
    for (const field of removed) delete next[field]
    write(table, next)
    recording?.writes.push({
      op: 'PATCH',
      id,
      fields: withSortedFields(value),
      remove: removed.sort()
    })
  }
  const replace = (id: string, value: Record<string, unknown>) => {
    const { table, document } = existing(id, 'Replace')
    write(table, { ...value, _id: id, _creationTime: document._creationTime })
    recording?.writes.push({ op: 'REPLACE', id, fields: fieldsOf(rowsOf(table).get(id)!) })
  }
  const inCreationOrder = (table: EncounterTableName) =>
    [...rowsOf(table).values()]
      .sort((left, right) => left._creationTime - right._creationTime)
      .map(served)
  const indexed = (table: EncounterTableName, index: string, bounds: Bound[]) => {
    const indexes: Readonly<Record<string, readonly string[]>> = encounterStoreIndexes[table]
    const fields = indexes[index]
    if (!fields) throw new Error(`Unknown index ${table}.${index}.`)
    const key = [...fields, '_creationTime']
    // Filter and order the stored documents, then copy only the matches; the key ends with the
    // creation time, so the order is total.
    return [...rowsOf(table).values()]
      .filter((document) => bounds.every((bound) => inRange(document, bound)))
      .sort((left, right) => {
        for (const field of key) {
          const order = compareValues(left[field], right[field])
          if (order !== 0) return order
        }
        return 0
      })
      .map(served)
  }

  const store = {
    async get(id: string) {
      const table = tableById.get(id)
      const document = table && tables.get(table)?.get(id)
      return document ? served(document) : null
    },
    query(table: EncounterTableName) {
      return {
        ...query(() => inCreationOrder(table)),
        withIndex: (index: string, range?: (builder: never) => IndexRange) => {
          const bounds = recordBounds(range)
          return query(() => indexed(table, index, bounds))
        }
      }
    },
    async insert(table: EncounterTableName, value: Record<string, unknown>) {
      // Not a UUID: identities never consume the transaction's random UUIDs.
      let id = `${idPrefix}:${++sequence}`
      while (tableById.has(id)) id = `${idPrefix}:${++sequence}`
      insert(table, id, ++clock, value)
      return id
    },
    async patch(id: string, value: Record<string, unknown>) {
      patch(id, value)
    },
    async replace(id: string, value: Record<string, unknown>) {
      replace(id, value)
    },
    async delete(id: string) {
      remove(id)
      recording?.writes.push({ op: 'DELETE', id })
    }
  }

  /** Runs `restore` with schema validation off for trusted restores such as checksummed rows. */
  const withValidation = (validate: boolean, restore: () => void) => {
    const previous = validating
    validating = validate
    try {
      restore()
    } finally {
      validating = previous
    }
  }
  const restoreDocument = (
    table: EncounterTableName,
    document: StoredDocument,
    validate: boolean
  ) => {
    clock = Math.max(clock, document._creationTime)
    if (document._id.startsWith(`${idPrefix}:`)) {
      const ordinal = Number(document._id.slice(idPrefix.length + 1))
      if (Number.isSafeInteger(ordinal)) sequence = Math.max(sequence, ordinal)
    }
    withValidation(validate, () => write(table, { ...document }))
  }

  return {
    // One generic implementation serves the interface's per-table and per-index overloads.
    store: store as unknown as EncounterStore,
    /** Every stored document of a table, in creation order. */
    documents<Table extends EncounterTableName>(table: Table) {
      return inCreationOrder(table) as EncounterDocument<Table>[]
    },
    /** The stored document with this identity, or null, without copying. Callers must not mutate it. */
    document(id: string) {
      const table = tableById.get(id)
      return (table && tables.get(table)?.get(id)) || null
    },
    /**
     * Restores documents with their stored identities and creation times. `validate: false` skips
     * schema validation for a restore from checksummed rows.
     */
    load<Table extends EncounterTableName>(
      table: Table,
      documents: EncounterDocument<Table>[],
      { validate = true }: { validate?: boolean } = {}
    ) {
      for (const document of documents) restoreDocument(table, document, validate)
    },
    /**
     * The next creation time and identity ordinals. A snapshot carries them so a restore keeps
     * issuing exactly the identities the live store would, even after its newest documents were deleted.
     */
    counters() {
      return { clock, sequence }
    },
    restoreCounters(counters: { clock: number; sequence: number }) {
      clock = Math.max(clock, counters.clock)
      sequence = Math.max(sequence, counters.sequence)
    },
    /** Drops every document and resets identities and creation times. */
    clear() {
      if (recording) throw new Error('Cannot clear the store inside a transaction.')
      tables.clear()
      tableById.clear()
      clock = 0
      sequence = 0
    },
    /** Replays recorded writes, as `commit` returned them, with the identities they carry. */
    apply(
      writes: readonly EncounterStoreWrite[],
      { validate = true }: { validate?: boolean } = {}
    ) {
      withValidation(validate, () => {
        for (const change of writes) {
          if (change.op === 'INSERT' || change.op === 'RESTORE') {
            restoreDocument(
              change.table,
              { ...change.fields, _id: change.id, _creationTime: change.creationTime },
              validate
            )
            recording?.writes.push(change)
          } else if (change.op === 'PATCH') {
            patch(change.id, {
              ...change.fields,
              ...Object.fromEntries(change.remove.map((field) => [field, undefined]))
            })
          } else if (change.op === 'REPLACE') replace(change.id, change.fields)
          else {
            remove(change.id)
            recording?.writes.push(change)
          }
        }
      })
    },
    transaction: {
      begin() {
        if (recording) throw new Error('A store transaction is already open.')
        recording = { writes: [], undo: [], clock, sequence }
      },
      /** The writes made so far, in order, without ending the transaction. */
      writes(): readonly EncounterStoreWrite[] {
        if (!recording) throw new Error('No store transaction is open.')
        return recording.writes
      },
      /** Ends the transaction and returns its writes in order. */
      commit() {
        if (!recording) throw new Error('No store transaction is open.')
        const { writes } = recording
        recording = null
        derivations?.renew()
        return writes
      },
      /** Ends the transaction and undoes its writes, its identities and its creation times. */
      abort() {
        if (!recording) throw new Error('No store transaction is open.')
        const { undo, clock: startClock, sequence: startSequence } = recording
        recording = null
        for (const reverse of undo.reverse()) reverse()
        clock = startClock
        sequence = startSequence
      }
    }
  }
}
