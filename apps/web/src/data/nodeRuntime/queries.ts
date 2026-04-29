import { queryOptions, useQuery } from '@tanstack/react-query'
import { api, type Api, type NodeRuntimeResolveRequestDto } from '#lib/api'
import { queryKeys } from '#lib/queryKeys'

export function fingerprintNodeRuntimeRequest(input: NodeRuntimeResolveRequestDto): string {
  return stableStringify(input)
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
