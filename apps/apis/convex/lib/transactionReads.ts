import type { GenericDatabaseReader } from 'convex/server'
import type { DataModel } from '../_generated/dataModel'

type DatabaseReader = GenericDatabaseReader<DataModel>
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

/**
 * One query transaction's reader that serves each identical read once: the same `get`, or the same
 * table, index range, order and terminal call. Reads in one query see one snapshot, so a repeat
 * returns what a fresh read would. A query reaches the database only when a read misses. Results
 * are deeply frozen, so no caller can change another caller's view. Filtered, search and streamed
 * reads pass through unmemoized.
 */
export function memoizeTransactionReads(db: DatabaseReader): DatabaseReader {
  const reads = new Map<string, Promise<unknown>>()
  function once(key: string, read: () => Promise<unknown>): Promise<unknown> {
    let result = reads.get(key)
    if (!result) {
      result = read().then(deepFreeze)
      reads.set(key, result)
    }
    return result
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
                readKey([table, ...steps.map(({ method, key }) => [method, key]), property, args]),
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
  return new Proxy(db, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property)
      if (typeof value !== 'function') return value
      if (property === 'get')
        return (...args: unknown[]) =>
          once(readKey(['get', ...args]), () => value.apply(target, args))
      if (property === 'query')
        return (...args: unknown[]) => query(() => value.apply(target, args), args[0], [])
      return value.bind(target)
    }
  })
}
