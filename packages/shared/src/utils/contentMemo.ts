/**
 * Memoizes a pure parse of immutable content, keyed by the exact content string. Use it only where
 * the result depends on nothing but that string: authorization and other reads around the parse
 * still run on every call. Results are deep-frozen so no caller can change a value another caller
 * shares, the least recently used entry goes past `limit`, and a failed parse is never stored.
 * Convex may keep module state between calls in a warm isolate, so a hit saves the parse there;
 * correctness never depends on one.
 */
export function createContentMemo<Value>(limit = 64) {
  const entries = new Map<string, Value>()
  return (content: string, parse: (content: string) => Value): Value => {
    if (entries.has(content)) {
      const value = entries.get(content) as Value
      entries.delete(content)
      entries.set(content, value)
      return value
    }
    const value = deepFreeze(parse(content))
    entries.set(content, value)
    if (entries.size > limit) entries.delete(entries.keys().next().value as string)
    return value
  }
}

function deepFreeze<Value>(value: Value): Value {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of value instanceof Map ? value.values() : Object.values(value))
    deepFreeze(child)
  return value
}
