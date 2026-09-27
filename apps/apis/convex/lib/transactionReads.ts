import type { GenericDatabaseReader } from 'convex/server'
import type { DataModel } from '../_generated/dataModel'

type DatabaseReader = GenericDatabaseReader<DataModel>
type Step = { method: 'withIndex' | 'order'; args: unknown[]; key: unknown[] }

const terminals = new Set<PropertyKey>(['unique', 'first', 'collect', 'take', 'paginate'])
const writes = new Set<PropertyKey>(['insert', 'patch', 'replace', 'delete'])

/** Serializes read arguments; `undefined` stays distinct from `null`, as it is in index bounds. */
function readKey(parts: unknown[]): string {
  return JSON.stringify(parts, (_key, value: unknown) =>
    value === undefined ? { $undefined: true } : value
  )
}

/** The bounds an index range callback applies, recorded without reading anything. */
function indexBounds(range: unknown): unknown[] {
  if (typeof range !== 'function') return []
  const bounds: unknown[] = []
  const recorder: object = new Proxy(
    {},
    {
      get:
        (_target, method) =>
        (...args: unknown[]) => {
          bounds.push([String(method), ...args])
          return recorder
        }
    }
  )
  range(recorder)
  return bounds
}

function deepFreeze<T>(value: T): T {
  if (
    typeof value === 'object' &&
    value !== null &&
    !Object.isFrozen(value) &&
    !ArrayBuffer.isView(value) &&
    !(value instanceof ArrayBuffer)
  ) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

/** Documents a memoized reader served: deeply frozen and shared by every identical read. */
const memoizedDocuments = new WeakSet<object>()
const derivations = new WeakMap<object, Map<unknown, unknown>>()
/** Every memoized reader, so wrapping one again returns it rather than a second memo. */
const memoizedReaders = new WeakSet<object>()

/** The stored documents in a read result: one document, a page, or an array. */
function resultDocuments(value: unknown): object[] {
  if (typeof value !== 'object' || value === null) return []
  if (Array.isArray(value)) return value.flatMap(resultDocuments)
  if ('_id' in value) return [value]
  if ('page' in value) return resultDocuments(value.page)
  return []
}

/**
 * A pure derivation (parse, checksum verification) of a stored document. For a document a
 * memoized reader served, it runs once per transaction and its deeply frozen result is shared, so
 * callers must not mutate it; any other document derives on every call. `derive` must be a stable
 * module-level function, since it keys the cache.
 */
export function deriveOnce<Document extends object, Value>(
  document: Document,
  derive: (document: Document) => Value
): Value {
  if (!memoizedDocuments.has(document)) return derive(document)
  let values = derivations.get(document)
  if (!values) {
    values = new Map()
    derivations.set(document, values)
  }
  if (!values.has(derive)) values.set(derive, deepFreeze(derive(document)))
  return values.get(derive) as Value
}

/**
 * One query transaction's reader that serves each identical read once: the same `get`, or the same
 * table, index range, order and terminal call. Reads in one query see one snapshot, so a repeat
 * returns what a fresh read would. Results are deeply frozen and shared, so no caller can change
 * another caller's view, and `deriveOnce` caches their derivations. Filtered, search and streamed
 * reads pass through unmemoized.
 */
export function memoizeTransactionReads<Database extends DatabaseReader>(db: Database): Database {
  return memoizeReads(db, true)
}

/**
 * The same memo for a mutation transaction, which also writes. Each read returns a private copy,
 * as a fresh read would, so callers may mutate what they read; `deriveOnce` derives every call.
 *
 * Write invariant: a read is served from the memo only while nothing it covers was written in the
 * transaction. Writes pass straight through and first drop every memoized read they could change:
 * the written document's `get` reads and every query read of its table (of every table when the
 * table is unknown, which only a write by bare ID to a document this memo never read causes). They
 * drop them again when the write settles, so a read issued while it was in flight is not kept.
 * Convex transactions are serializable, so a memoized read taken earlier in the same transaction is
 * as fresh as a new one for every fence. Install the memo beneath the trigger wrapper
 * (`memoizedInternalMutation`) so trigger writes invalidate it too; a written document is never
 * served stale.
 */
export function memoizeMutationReads<Database extends DatabaseReader>(db: Database): Database {
  return memoizeReads(db, false)
}

function memoizeReads<Database extends DatabaseReader>(db: Database, share: boolean): Database {
  if (memoizedReaders.has(db)) return db
  const gets = new Map<string, Map<string, Promise<unknown>>>()
  const queries = new Map<unknown, Map<string, Promise<unknown>>>()
  /** Every unwritten document a read returned, by ID, so any later `get` of it is served. */
  const documents = new Map<string, { table: unknown; document: object }>()
  /** The table of each document this transaction inserted, for a later write by bare ID. */
  const inserted = new Map<string, unknown>()
  /** Counts write starts and ends; a read that overlapped a write never records its documents. */
  let writeEpoch = 0
  const serve = (value: unknown) => (share ? value : structuredClone(value))
  async function once(
    reads: Map<string, Promise<unknown>>,
    key: string,
    table: unknown,
    read: () => Promise<unknown>
  ): Promise<unknown> {
    let result = reads.get(key)
    if (!result) {
      const epoch = writeEpoch
      result = read().then((value) => {
        for (const document of resultDocuments(value)) {
          if (share) memoizedDocuments.add(document)
          const id = String((document as { _id: unknown })._id)
          if (epoch === writeEpoch)
            documents.set(id, { table: table ?? documents.get(id)?.table, document })
        }
        return share ? deepFreeze(value) : value
      })
      reads.set(key, result)
    }
    return serve(await result)
  }
  function readsOf<Key>(map: Map<Key, Map<string, Promise<unknown>>>, key: Key) {
    let reads = map.get(key)
    if (!reads) {
      reads = new Map()
      map.set(key, reads)
    }
    return reads
  }
  /** Drops what a write to document `id` (none for an insert) of `table` could change. */
  function invalidate(table: unknown, id: string | undefined) {
    writeEpoch++
    if (id !== undefined) {
      gets.delete(id)
      documents.delete(id)
    }
    if (table === undefined) queries.clear()
    else queries.delete(table)
  }
  function query(open: () => unknown, table: unknown, steps: readonly Step[]): object {
    function materialize(): object {
      let builder: unknown = open()
      for (const { method, args } of steps) {
        const next: unknown = Reflect.get(Object(builder), method)
        if (typeof next !== 'function') throw new Error('Unsupported query step.')
        builder = next.apply(builder, args)
      }
      return Object(builder)
    }
    return new Proxy(
      {},
      {
        get(_target, property) {
          if (property === 'withIndex' || property === 'order')
            return (...args: unknown[]) =>
              query(open, table, [
                ...steps,
                {
                  method: property,
                  args,
                  key: property === 'withIndex' ? [args[0], indexBounds(args[1])] : args
                }
              ])
          if (terminals.has(property))
            return (...args: unknown[]) =>
              once(
                readsOf(queries, table),
                readKey([steps.map(({ method, key }) => [method, key]), property, args]),
                table,
                () => {
                  const builder = materialize()
                  const read: unknown = Reflect.get(builder, property)
                  if (typeof read !== 'function') throw new Error('Unsupported query read.')
                  return read.apply(builder, args)
                }
              )
          const builder = materialize()
          const value: unknown = Reflect.get(builder, property)
          return typeof value === 'function' ? value.bind(builder) : value
        }
      }
    )
  }
  const memoized = new Proxy(db, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property)
      if (typeof value !== 'function') return value
      // get(id) or get(table, id): a document any read already returned is served by its ID.
      if (property === 'get')
        return async (...args: unknown[]) => {
          const id = String(args.at(-1))
          const table = args.length > 1 ? args[0] : undefined
          const known = documents.get(id)
          if (known && (table === undefined || known.table === table)) return serve(known.document)
          return once(readsOf(gets, id), readKey(args), table, () => value.apply(target, args))
        }
      if (property === 'query')
        return (...args: unknown[]) => query(() => value.apply(target, args), args[0], [])
      if (writes.has(property))
        return async (...args: unknown[]) => {
          // insert(table, value); patch/replace(id, value) or (table, id, value); delete(id) or
          // (table, id).
          const tableFirst =
            property === 'insert' || args.length === (property === 'delete' ? 2 : 3)
          const id = property === 'insert' ? undefined : String(tableFirst ? args[1] : args[0])
          const table =
            (tableFirst ? args[0] : undefined) ??
            (id === undefined ? undefined : (documents.get(id)?.table ?? inserted.get(id)))
          invalidate(table, id)
          try {
            const result: unknown = await value.apply(target, args)
            if (property === 'insert') inserted.set(String(result), table)
            return result
          } finally {
            invalidate(table, id)
          }
        }
      return value.bind(target)
    }
  })
  memoizedReaders.add(memoized)
  return memoized
}
