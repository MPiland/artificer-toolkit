import type { IndexRange } from 'convex/server'
import type {
  EncounterDocument,
  EncounterOrderedQuery,
  EncounterQuery,
  EncounterStore,
  EncounterTableName
} from './store.js'
import { encounterStoreIndexes, encounterStoreSchemas } from './storeTables.js'

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

/** A copy with object fields in key order, as Convex stores and returns documents. */
function withSortedFields<Value>(value: Value): Value {
  if (Array.isArray(value)) return value.map(withSortedFields) as Value
  if (typeof value !== 'object' || value === null || value instanceof ArrayBuffer) return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
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
 * An in-memory Encounter store with Convex's transaction semantics: index order with the
 * creation-time tiebreaker, `unique` refusing duplicates, a private copy on every read, stored
 * schema validation on every write, and `patch` removing fields set to `undefined`. The
 * conformance suite checks the Convex adapter against it.
 */
export function createMemoryEncounterStore() {
  const tables = new Map<EncounterTableName, Map<string, StoredDocument>>()
  const tableById = new Map<string, EncounterTableName>()
  let clock = 0
  let sequence = 0

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
    encounterStoreSchemas[table].parse(fields)
    rowsOf(table).set(_id, withSortedFields(document))
    tableById.set(_id, table)
  }
  const inCreationOrder = (table: EncounterTableName) =>
    [...rowsOf(table).values()]
      .sort((left, right) => left._creationTime - right._creationTime)
      .map((document) => structuredClone(document))
  const indexed = (table: EncounterTableName, index: string, bounds: Bound[]) => {
    const indexes: Readonly<Record<string, readonly string[]>> = encounterStoreIndexes[table]
    const fields = indexes[index]
    if (!fields) throw new Error(`Unknown index ${table}.${index}.`)
    const key = [...fields, '_creationTime']
    return inCreationOrder(table)
      .filter((document) => bounds.every((bound) => inRange(document, bound)))
      .sort((left, right) => {
        for (const field of key) {
          const order = compareValues(left[field], right[field])
          if (order !== 0) return order
        }
        return 0
      })
  }

  const store = {
    async get(id: string) {
      const table = tableById.get(id)
      const document = table && tables.get(table)?.get(id)
      return document ? structuredClone(document) : null
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
      let _id = `memory:${++sequence}`
      while (tableById.has(_id)) _id = `memory:${++sequence}`
      write(table, { ...value, _id, _creationTime: ++clock })
      return _id
    },
    async patch(id: string, value: Record<string, unknown>) {
      const { table, document } = existing(id, 'Patch')
      const next: StoredDocument = { ...document, ...value }
      for (const [field, fieldValue] of Object.entries(value))
        if (fieldValue === undefined) delete next[field]
      write(table, next)
    },
    async replace(id: string, value: Record<string, unknown>) {
      const { table, document } = existing(id, 'Replace')
      write(table, { ...value, _id: id, _creationTime: document._creationTime })
    },
    async delete(id: string) {
      const { table } = existing(id, 'Delete')
      tables.get(table)?.delete(id)
      tableById.delete(id)
    }
  }

  return {
    // One generic implementation serves the interface's per-table and per-index overloads.
    store: store as unknown as EncounterStore,
    /** Every stored document of a table, in creation order. */
    documents<Table extends EncounterTableName>(table: Table) {
      return inCreationOrder(table) as unknown as EncounterDocument<Table>[]
    },
    /** Restores documents with their stored identities and creation times. */
    load<Table extends EncounterTableName>(table: Table, documents: EncounterDocument<Table>[]) {
      for (const document of documents) {
        clock = Math.max(clock, document._creationTime)
        write(table, { ...document })
      }
    }
  }
}
