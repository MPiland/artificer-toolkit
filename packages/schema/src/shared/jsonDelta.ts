import { z, lazySchema } from '../zod.js'
import type { JsonValue } from '../projections/identity.js'

export type { JsonValue } from '../projections/identity.js'

/** JSON replacement, changed object keys, or retained array ends around a new middle. */
export type JsonDelta =
  | { set: JsonValue }
  | { keys: Record<string, JsonDelta>; drop: string[] }
  | { keep: [number, number]; splice: JsonValue[] }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isJsonValue(value: unknown, ancestors: Set<object>): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (!Array.isArray(value) && !isPlainObject(value)) return false
  if (ancestors.has(value)) return false
  ancestors.add(value)
  try {
    if (Array.isArray(value))
      for (let index = 0; index < value.length; index++)
        if (!Object.hasOwn(value, index)) return false
    return Reflect.ownKeys(value).every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return (
        !descriptor?.enumerable ||
        (typeof key === 'string' &&
          'value' in descriptor &&
          isJsonValue(descriptor.value, ancestors))
      )
    })
  } finally {
    ancestors.delete(value)
  }
}

/** Validates raw JSON without dropping own keys such as `__proto__`. */
export const canonicalJsonValueSchema: z.ZodMiniType<JsonValue> = lazySchema(() =>
  z.custom<JsonValue>((value) => {
    try {
      return isJsonValue(value, new Set())
    } catch {
      return false
    }
  })
)

export const canonicalJsonRecordSchema: z.ZodMiniType<Record<string, JsonValue>> = lazySchema(() =>
  z.custom<Record<string, JsonValue>>(
    (value) => isPlainObject(value) && canonicalJsonValueSchema.safeParse(value).success
  )
)

function isJsonDelta(value: unknown, ancestors: Set<object>): boolean {
  if (!isPlainObject(value) || ancestors.has(value)) return false
  ancestors.add(value)
  try {
    const keys = Reflect.ownKeys(value)
    if (keys.length === 1 && Object.hasOwn(value, 'set')) return isJsonValue(value.set, ancestors)
    if (keys.length !== 2) return false
    if (Object.hasOwn(value, 'keys') && Object.hasOwn(value, 'drop')) {
      const changes = value.keys
      if (!isPlainObject(changes) || ancestors.has(changes)) return false
      ancestors.add(changes)
      try {
        return (
          Reflect.ownKeys(changes).every(
            (key) => typeof key === 'string' && isJsonDelta(Reflect.get(changes, key), ancestors)
          ) &&
          Array.isArray(value.drop) &&
          isJsonValue(value.drop, ancestors) &&
          value.drop.every((key) => typeof key === 'string')
        )
      } finally {
        ancestors.delete(changes)
      }
    }
    return (
      Object.hasOwn(value, 'keep') &&
      Object.hasOwn(value, 'splice') &&
      Array.isArray(value.keep) &&
      value.keep.length === 2 &&
      isJsonValue(value.keep, ancestors) &&
      value.keep.every(
        (count) => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
      ) &&
      Array.isArray(value.splice) &&
      isJsonValue(value.splice, ancestors)
    )
  } finally {
    ancestors.delete(value)
  }
}

// Zod's record parser drops __proto__; validate without transforming these raw JSON keys.
export const jsonDeltaSchema: z.ZodMiniType<JsonDelta> = lazySchema(() =>
  z.custom<JsonDelta>((value) => {
    try {
      return isJsonDelta(value, new Set())
    } catch {
      return false
    }
  })
)
