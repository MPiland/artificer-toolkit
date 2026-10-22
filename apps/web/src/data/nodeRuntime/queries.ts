import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  nodeRuntimeResolveRequestDtoSchema,
  type NodeRuntimeResolveRequestDto,
  type NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  expandNodeRuntimeResponse,
  type NodeRuntimeCompactResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntimeTransport'
import { isRecord } from '#app/forms/utils/valueGuards'

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
  'text'
])

export function fingerprintNodeRuntimeRequest(input: NodeRuntimeResolveRequestDto): string {
  return stableStringify(stripCopyOnlyFields(input))
}

export function getNodeRuntimeResolve(input: NodeRuntimeResolveRequestDto, enabled = true) {
  const { queryKey } = convexQuery(
    convexApi.authoring.nodeRuntime.resolve,
    enabled && input.systemId
      ? nodeRuntimeResolveRequestDtoSchema.parse(JSON.parse(JSON.stringify(input)))
      : 'skip'
  )
  return queryOptions<NodeRuntimeCompactResolveResponseDto>({
    queryKey,
    enabled: enabled && Boolean(input.systemId),
    staleTime: Infinity
  })
}

export function useNodeRuntimeResolve(input: NodeRuntimeResolveRequestDto, enabled = true) {
  const resolveEnabled = enabled && Boolean(input.systemId)
  return useQuery<NodeRuntimeCompactResolveResponseDto, Error, NodeRuntimeResolveResponseDto>({
    ...getNodeRuntimeResolve(input, resolveEnabled),
    enabled: resolveEnabled,
    placeholderData: keepPreviousData,
    // Stable identity lets React Query reuse decoded scopes across unrelated form rerenders.
    select: expandNodeRuntimeResponse
  })
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (isRecord(value)) {
    return Object.entries(value)
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
  if (isRecord(value)) {
    return Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((record, [entryKey, child]) => {
        const stripped = stripCopyOnlyFields(child, entryKey)
        if (stripped !== undefined) record[entryKey] = stripped
        return record
      }, {})
  }

  return value
}
