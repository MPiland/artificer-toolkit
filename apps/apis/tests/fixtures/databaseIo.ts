type TableTotals = Record<string, { documents: number; distinct: number; bytes: number }>

export type DatabaseIoTotals = {
  reads: { documents: number; bytes: number; byTable: TableTotals }
  writes: { documents: number; bytes: number; byTable: TableTotals }
}

export function createDatabaseIoTotals(): DatabaseIoTotals {
  return {
    reads: { documents: 0, bytes: 0, byTable: {} },
    writes: { documents: 0, bytes: 0, byTable: {} }
  }
}

const WRITE_METHODS = new Set(['insert', 'replace', 'patch', 'delete'])

/** JSON size, with binary fields (stored `v.bytes()` chunks) counted at their byte length. */
function documentBytes(value: unknown) {
  let binaryBytes = 0
  const json = JSON.stringify(value, (_key, field: unknown) => {
    if (!(field instanceof ArrayBuffer) && !ArrayBuffer.isView(field)) return field
    binaryBytes += field.byteLength
    return null
  })
  return new TextEncoder().encode(json).byteLength + binaryBytes
}

/**
 * Counts every document a transaction reads through `db` at its JSON size, per table (a `get` is
 * counted under `get`), and every write at the JSON size of the value written, under the insert's
 * table, the table an explicit-table write names, or else the write method. Wrap it beneath any trigger layer so trigger reads count too.
 */
export function countDatabaseIo<T extends object>(db: T, totals: DatabaseIoTotals): T {
  const seen = new Set<string>()
  const add = (
    side: DatabaseIoTotals['reads'],
    table: string,
    bytes: number,
    id: string | undefined
  ) => {
    const entry = (side.byTable[table] ??= { documents: 0, distinct: 0, bytes: 0 })
    entry.documents += 1
    if (id === undefined || !seen.has(id)) entry.distinct += 1
    if (id !== undefined) seen.add(id)
    entry.bytes += bytes
    side.documents += 1
    side.bytes += bytes
  }
  const countRead = (table: string, value: unknown) => {
    const documents = Array.isArray(value)
      ? value
      : value !== null && typeof value === 'object' && 'page' in value && Array.isArray(value.page)
        ? value.page
        : [value]
    for (const document of documents)
      if (document !== null && typeof document === 'object' && '_id' in document)
        add(totals.reads, table, documentBytes(document), String(document._id))
  }
  const countWrite = (method: string, args: readonly unknown[]) => {
    // `replace`, `patch` and `delete` name their table only in the explicit-table form, which
    // takes one argument more than the id form.
    const named = method === 'insert' || args.length === (method === 'delete' ? 2 : 3)
    const table = named && typeof args[0] === 'string' ? args[0] : method
    const valueIndex = method === 'insert' || !named ? 1 : 2
    const value = method === 'delete' ? null : args[valueIndex]
    add(totals.writes, table, value === null ? 0 : documentBytes(value), undefined)
  }
  const wrap = <U extends object>(target: U, table: string): U =>
    new Proxy(target, {
      get(object, property) {
        const value: unknown = Reflect.get(object, property)
        if (typeof value !== 'function') return value
        const method = value as (...args: unknown[]) => unknown
        if (property === Symbol.asyncIterator)
          return () => {
            const iterator = method.call(object) as AsyncIterator<unknown>
            return {
              next: async () => {
                const step = await iterator.next()
                if (!step.done) countRead(table, step.value)
                return step
              },
              [Symbol.asyncIterator]() {
                return this
              }
            }
          }
        return (...args: unknown[]) => {
          if (typeof property === 'string' && WRITE_METHODS.has(property))
            countWrite(property, args)
          const result = method.apply(object, args)
          const label = property === 'query' && typeof args[0] === 'string' ? args[0] : table
          if (result instanceof Promise)
            return result.then((resolved: unknown) => {
              if (typeof property !== 'string' || !WRITE_METHODS.has(property))
                countRead(label, resolved)
              return resolved
            })
          return result !== null && typeof result === 'object' ? wrap(result, label) : result
        }
      }
    })
  return wrap(db, 'get')
}
