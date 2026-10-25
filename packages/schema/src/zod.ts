import { config, z } from 'zod/mini'
import en from 'zod/v4/locales/en.js'

config(en())

export { z }

/**
 * Builds a schema on first use and memoizes it (D59). Convex re-evaluates a function's module graph
 * on every call, so a schema built at module load is paid per call. The proxy forwards every
 * operation to the built schema, so its static type, `instanceof`, parsing, issues, `.shape`,
 * composition and `zodToConvex` output are the built schema's. `scripts/lazySchemas.mjs --check`
 * (in `yarn lint`) keeps module-level schemas behind it; `z.json()` must stay eager because it
 * references its own instance.
 */
export function lazySchema<Schema extends { _zod: object }>(build: () => Schema): Schema {
  let schema: Schema | undefined
  const resolve = (): Schema => (schema ??= build())
  return new Proxy(Object.create(null) as Schema, {
    get: (_, key) => Reflect.get(resolve(), key),
    set: (_, key, value) => Reflect.set(resolve(), key, value),
    has: (_, key) => Reflect.has(resolve(), key),
    ownKeys: () => Reflect.ownKeys(resolve()),
    // The empty target holds no properties, so a forwarded descriptor must be configurable.
    getOwnPropertyDescriptor: (_, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(resolve(), key)
      return descriptor && { ...descriptor, configurable: true }
    },
    defineProperty: (_, key, descriptor) => Reflect.defineProperty(resolve(), key, descriptor),
    deleteProperty: (_, key) => Reflect.deleteProperty(resolve(), key),
    getPrototypeOf: () => Reflect.getPrototypeOf(resolve())
  })
}

/**
 * Marks a schema as a named `v.any()` leaf of every Convex validator built from it (D194).
 * `zodToConvex` inlines each use of a shared schema, because Convex validators have no references,
 * so a deep authored tree (facets, effect paths, follow-up outcomes) would emit millions of nodes.
 * The zod parse still validates the value in full, and handlers declare the DTO type they return.
 */
export function convexOpaqueSchema<Schema extends z.ZodMiniType>(schema: Schema) {
  return z.pipe(z.unknown(), schema)
}

/**
 * Builds shared schema parts (a shape spread into several objects, or a variant list reused by
 * several unions) on first call and returns the same parts after, so every schema that uses them
 * shares one set of instances, as a module-level constant did.
 */
export function lazySchemaParts<Parts extends object>(build: () => Parts): () => Parts {
  let parts: Parts | undefined
  return () => (parts ??= build())
}
