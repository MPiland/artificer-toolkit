import type { JsonDelta, JsonValue } from '@artificer-toolkit/schema/shared/jsonDelta'

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const same = (left: JsonValue, right: JsonValue) => JSON.stringify(left) === JSON.stringify(right)

/** The delta from `previous` to `next`, or null when they are equal. */
export function diffJson(previous: JsonValue, next: JsonValue): JsonDelta | null {
  if (same(previous, next)) return null
  if (isObject(previous) && isObject(next)) {
    const keys: [string, JsonDelta][] = []
    for (const [key, value] of Object.entries(next)) {
      const delta = Object.hasOwn(previous, key) ? diffJson(previous[key]!, value) : { set: value }
      if (delta) keys.push([key, delta])
    }
    return {
      keys: Object.fromEntries(keys),
      drop: Object.keys(previous).filter((key) => !Object.hasOwn(next, key))
    }
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
    const next: [string, JsonValue][] = []
    for (const [key, value] of Object.entries(previous))
      if (!delta.drop.includes(key))
        next.push([
          key,
          Object.hasOwn(delta.keys, key) ? applyJsonDelta(value, delta.keys[key]!) : value
        ])
    for (const [key, change] of Object.entries(delta.keys))
      if (!Object.hasOwn(previous, key)) next.push([key, applyJsonDelta(null, change)])
    return Object.fromEntries(next)
  }
  if (!Array.isArray(previous) || delta.keep[0] + delta.keep[1] > previous.length)
    throw new Error('A JSON array delta needs the array it was taken from.')
  return [
    ...previous.slice(0, delta.keep[0]),
    ...delta.splice,
    ...previous.slice(previous.length - delta.keep[1])
  ]
}
