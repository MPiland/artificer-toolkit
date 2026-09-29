export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

/**
 * How one JSON value became the next: replaced whole, an object whose listed keys changed, or an
 * array that kept `keep[0]` leading and `keep[1]` trailing items around new middle items. A pending
 * snapshot's parts store these so an update writes only what changed (ADR 0035 Amendment 12).
 */
export type JsonDelta =
  | { set: JsonValue }
  | { keys: { [key: string]: JsonDelta }; drop: string[] }
  | { keep: [number, number]; splice: JsonValue[] }

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const same = (left: JsonValue, right: JsonValue) => JSON.stringify(left) === JSON.stringify(right)

/** The delta from `previous` to `next`, or null when they are equal. */
export function diffJson(previous: JsonValue, next: JsonValue): JsonDelta | null {
  if (same(previous, next)) return null
  if (isObject(previous) && isObject(next)) {
    const keys: { [key: string]: JsonDelta } = {}
    for (const [key, value] of Object.entries(next)) {
      const delta = key in previous ? diffJson(previous[key]!, value) : { set: value }
      if (delta) keys[key] = delta
    }
    return { keys, drop: Object.keys(previous).filter((key) => !(key in next)) }
  }
  if (Array.isArray(previous) && Array.isArray(next)) {
    const limit = Math.min(previous.length, next.length)
    let prefix = 0
    while (prefix < limit && same(previous[prefix]!, next[prefix]!)) prefix++
    let suffix = 0
    while (
      suffix < limit - prefix &&
      same(previous[previous.length - 1 - suffix]!, next[next.length - 1 - suffix]!)
    )
      suffix++
    return { keep: [prefix, suffix], splice: next.slice(prefix, next.length - suffix) }
  }
  return { set: next }
}

/** Applies a `diffJson` delta to the value it was taken from. */
export function applyJsonDelta(previous: JsonValue, delta: JsonDelta): JsonValue {
  if ('set' in delta) return delta.set
  if ('keys' in delta) {
    if (!isObject(previous)) throw new Error('A JSON object delta needs an object.')
    const next: { [key: string]: JsonValue } = {}
    for (const [key, value] of Object.entries(previous))
      if (!delta.drop.includes(key))
        next[key] = key in delta.keys ? applyJsonDelta(value, delta.keys[key]!) : value
    for (const [key, change] of Object.entries(delta.keys))
      if (!(key in previous)) next[key] = applyJsonDelta(null, change)
    return next
  }
  if (!Array.isArray(previous) || delta.keep[0] + delta.keep[1] > previous.length)
    throw new Error('A JSON array delta needs the array it was taken from.')
  return [
    ...previous.slice(0, delta.keep[0]),
    ...delta.splice,
    ...previous.slice(previous.length - delta.keep[1])
  ]
}
