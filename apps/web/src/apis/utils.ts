import { QueryClient } from '@tanstack/react-query'
import type { Simplify } from 'type-fest'

export const queryClient = new QueryClient()

export const aggregateMeta = (metaProp: string, dataProp: string, data: unknown[]) => {
  const metaMap = new Map<string, Set<string>>()
  for (const row of data ?? []) {
    const metaId = row?.[`${metaProp}`]
    const dataId = row?.[`${dataProp}`]
    if (!metaId || !dataId) continue
    if (!metaMap.has(metaId)) metaMap.set(metaId, new Set())
    metaMap.get(metaId)!.add(dataId)
  }

  return metaMap
}

type AnyObject = Record<string, unknown>

const toPascalCase = (str: string): string => {
  return str.replace(/(^\w|_\w)/g, (m) => m.replace('_', '').toUpperCase())
}

/**
 * WithTypename
 * Adds a literal __typename at the current level (N) and recursively to all nested object fields.
 * - Preserves optional and readonly keys
 * - Distributes over unions
 * - Uses Capitalize<key> for nested levels
 */
export type WithTypename<T, N extends string> =
  // Distribute over unions
  T extends readonly (infer TU)[] ? Array<WithTypename<TU, N>>
  : T extends (infer U)[] ? Array<WithTypename<U, N>>
  : T extends object ?
    Simplify<
      {
        [K in keyof T]: T[K] extends readonly (infer RU)[] ? Array<WithTypename<RU, Capitalize<string & K>>>
        : T[K] extends (infer AU)[] ? Array<WithTypename<AU, Capitalize<string & K>>>
        : T[K] extends object ? WithTypename<T[K], Capitalize<string & K>>
        : T[K]
      } & { __typename: N }
    >
  : T

export const addTypename = <T extends object, N extends string>(obj: T, rootTypename: N): WithTypename<T, N> => {
  function recurse(value: unknown, typename: string): unknown {
    if (Array.isArray(value)) {
      return value.map((v) => (typeof v === 'object' && v !== null ? recurse(v, typename) : v))
    } else if (typeof value === 'object' && value !== null) {
      const nested = value as AnyObject
      const result: AnyObject = { __typename: typename }

      for (const k in nested) {
        if (k === '__kind') continue // skip __kind
        const v = nested[k]
        result[k] = typeof v === 'object' && v !== null ? recurse(v, toPascalCase(k)) : v
      }

      return result
    }

    return value
  }

  return recurse(obj, rootTypename) as WithTypename<T, N>
}

/**
 * WithKind
 * Adds a literal __kind at the current level (K) and recursively to all nested object fields.
 */
export type WithKind<T, K extends string> =
  T extends readonly (infer TU)[] ? Array<WithKind<TU, `${K}Input`>>
  : T extends (infer U)[] ? Array<WithKind<U, `${K}Input`>>
  : T extends object ?
    Simplify<
      {
        [P in keyof T]: T[P] extends readonly (infer RU)[] ? Array<WithKind<RU, `${Capitalize<string & P>}Input`>>
        : T[P] extends (infer AU)[] ? Array<WithKind<AU, `${Capitalize<string & P>}Input`>>
        : T[P] extends object ? WithKind<T[P], `${Capitalize<string & P>}Input`>
        : T[P]
      } & { __kind: `${K}Input` }
    >
  : T
