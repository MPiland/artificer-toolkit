import { useMemo, useState } from 'react'
import { replaceEqualDeep } from '@tanstack/react-query'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { fingerprintNodeRuntimeRequest, useNodeRuntimeResolve } from '#app/data/nodeRuntime/queries'

/** Callers pass debounced values (`useDebouncedFormState`); each request resolves at once. */
interface UseResolvedNodeModelOptions {
  mapId: string
  values: Record<string, unknown>
  parentValues?: Record<string, unknown>
  ancestors?: Record<string, unknown>[]
  systemId?: string
  enabled?: boolean
}

export function useResolvedNodeModel({
  mapId,
  values,
  parentValues,
  ancestors,
  systemId,
  enabled = true
}: UseResolvedNodeModelOptions) {
  const request = useMemo(
    () => ({
      mapId,
      values,
      parentValues,
      ancestors,
      systemId: systemId ?? ''
    }),
    [ancestors, mapId, parentValues, systemId, values]
  )
  // Copy fields (names, descriptions) never change a resolution, so editing only them keeps the
  // resolved request and sends nothing.
  const fingerprint = useMemo(() => fingerprintNodeRuntimeRequest(request), [request])
  const [resolvedRequest, setResolvedRequest] = useState({ fingerprint, request })
  if (resolvedRequest.fingerprint !== fingerprint) setResolvedRequest({ fingerprint, request })
  const query = useNodeRuntimeResolve(resolvedRequest.request, enabled && Boolean(systemId))
  // Each request has its own query, so an unchanged resolution would arrive as a new object; sharing
  // it keeps the previous model's identity and its readers do not re-render. While a refresh is
  // pending the previous model stays as it was.
  const shareModel = useMemo(() => {
    let previous: NodeRuntimeResolveResponseDto | undefined
    return (next: NodeRuntimeResolveResponseDto) => (previous = replaceEqualDeep(previous, next))
  }, [])
  const model = useMemo(
    () => (query.data ? shareModel(query.data) : undefined),
    [query.data, shareModel]
  )

  return { model, error: query.error, isFetching: query.isFetching, refetch: query.refetch }
}
