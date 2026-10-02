type Step = { method: 'withIndex' | 'order'; args: unknown[]; key: unknown[] }

const terminals = new Set<PropertyKey>(['unique', 'first', 'collect', 'take', 'paginate'])

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

/** One memoized transaction's derivations by content identity: by derivation, then by identity. */
type DerivationScope = Map<unknown, Map<string, unknown>>
/** The transaction of each document a memo served, and of each value derived from one. */
const scopes = new WeakMap<object, DerivationScope>()
/** The transaction whose derivation is running, for the values it builds before returning them. */
let deriving: DerivationScope | undefined
const derivations = new WeakMap<object, Map<unknown, unknown>>()
/** Every memoized reader; wrapping one again returns it rather than a second memo. */
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
 * A pure derivation (parse, checksum verification) of a document a query memo served, or of a
 * value an earlier derivation returned. It runs once per transaction and its deeply frozen result
 * is shared, so callers must not mutate it. Any other value derives on every call, unless an
 * enclosing derivation built it. `derive` must be a stable module-level function that never
 * mutates its input, since it keys the cache.
 *
 * With `identity`, a derivation is also shared by every document in the transaction with the same
 * identity. `identity` must distinguish every difference in the fields `derive` reads.
 */
export function deriveOnce<Document extends object, Value>(
  document: Document,
  derive: (document: Document) => Value,
  identity?: (document: Document) => string
): Value {
  const scope = scopes.get(document) ?? deriving
  if (!scope) return derive(document)
  let values = derivations.get(document)
  if (!values) {
    values = new Map()
    derivations.set(document, values)
  }
  if (!values.has(derive)) {
    const run = () => {
      const outer = deriving
      deriving = scope
      try {
        return derive(document)
      } finally {
        deriving = outer
      }
    }
    let value: unknown
    if (identity) {
      let shared = scope.get(derive)
      if (!shared) {
        shared = new Map()
        scope.set(derive, shared)
      }
      const key = identity(document)
      value = shared.has(key) ? shared.get(key) : run()
      shared.set(key, value)
    } else value = run()
    if (typeof value === 'object' && value !== null) {
      scopes.set(value, scope)
      deepFreeze(value)
    }
    values.set(derive, value)
  }
  return values.get(derive) as Value
}

/**
 * One query transaction's reader that serves each identical read once: the same `get`, or the same
 * table, index range, order and terminal call. Reads in one query see one snapshot, so a repeat
 * returns what a fresh read would. Results are deeply frozen and shared, so no caller can change
 * another caller's view, and `deriveOnce` caches their derivations. Filtered, search and streamed
 * reads pass through unmemoized. A query transaction cannot write, so nothing is ever invalidated.
 */
export function memoizeTransactionReads<Database extends object>(db: Database): Database {
  if (memoizedReaders.has(db)) return db
  const gets = new Map<string, Map<string, Promise<unknown>>>()
  const queries = new Map<unknown, Map<string, Promise<unknown>>>()
  /** Every document a read returned, by ID, so any later `get` of it is served. */
  const documents = new Map<string, { table: unknown; document: object }>()
  const scope: DerivationScope = new Map()
  async function once(
    reads: Map<string, Promise<unknown>>,
    key: string,
    table: unknown,
    read: () => Promise<unknown>
  ): Promise<unknown> {
    let result = reads.get(key)
    if (!result) {
      result = read().then((value) => {
        for (const document of resultDocuments(value)) {
          scopes.set(document, scope)
          const id = String((document as { _id: unknown })._id)
          documents.set(id, { table: table ?? documents.get(id)?.table, document })
        }
        return deepFreeze(value)
      })
      reads.set(key, result)
    }
    return result
  }
  function readsOf<Key>(map: Map<Key, Map<string, Promise<unknown>>>, key: Key) {
    let reads = map.get(key)
    if (!reads) {
      reads = new Map()
      map.set(key, reads)
    }
    return reads
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
          if (known && (table === undefined || known.table === table)) return known.document
          return once(readsOf(gets, id), readKey(args), table, () => value.apply(target, args))
        }
      if (property === 'query')
        return (...args: unknown[]) => query(() => value.apply(target, args), args[0], [])
      return value.bind(target)
    }
  })
  memoizedReaders.add(memoized)
  return memoized
}
