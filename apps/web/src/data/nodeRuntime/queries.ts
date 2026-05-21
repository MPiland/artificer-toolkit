import { queryOptions, useQuery } from '@tanstack/react-query'
import { api, type Api, type NodeRuntimeResolveRequestDto } from '#lib/api'
import { queryKeys } from '#lib/queryKeys'

const runtimeCopyFieldNames = new Set([
  'body',
  'description',
  'detail',
  'label',
  'name',
  'notes',
  'quote',
  'short',
  'summary',
  'text',
  'tooltip'
])

export function fingerprintNodeRuntimeRequest(input: NodeRuntimeResolveRequestDto): string {
  return stableStringify(stripCopyOnlyFields(input))
}

export function getNodeRuntimeResolve(input: NodeRuntimeResolveRequestDto, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.nodeRuntime.resolve(input.mapId, fingerprintNodeRuntimeRequest(input)),
    queryFn: async () => await client.nodeRuntime.resolve(input)
  })
}

export function useNodeRuntimeResolve(input: NodeRuntimeResolveRequestDto, enabled = true) {
  return useQuery({
    ...getNodeRuntimeResolve(input),
    enabled
  })
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((record, [key, child]) => {
        record[key] = sortValue(child)
        return record
      }, {})
  }

  return value
}

function stripCopyOnlyFields(value: unknown, key?: string): unknown {
  if (key && runtimeCopyFieldNames.has(key)) return undefined
  if (Array.isArray(value)) return value.map((item) => stripCopyOnlyFields(item))
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((record, [entryKey, child]) => {
        const stripped = stripCopyOnlyFields(child, entryKey)
        if (stripped !== undefined) record[entryKey] = stripped
        return record
      }, {})
  }

  return value
}
