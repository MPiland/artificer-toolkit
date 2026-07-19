import { useEffect, useMemo, useState } from 'react'
import type { NodeRuntimePathDto, NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { fingerprintNodeRuntimeRequest, useNodeRuntimeResolve } from '#app/data/nodeRuntime/queries'

export interface UseResolvedNodeModelOptions {
  mapId: string
  values: Record<string, unknown>
  parentValues?: Record<string, unknown>
  ancestors?: Record<string, unknown>[]
  systemId?: string
  enabled?: boolean
  debounceMs?: number
  onClearPaths?: (paths: readonly NodeRuntimePathDto[]) => void
}

export function useResolvedNodeModel({
  mapId,
  values,
  parentValues,
  ancestors,
  systemId,
  enabled = true,
  debounceMs = 150,
  onClearPaths
}: UseResolvedNodeModelOptions): NodeRuntimeResolveResponseDto | undefined {
  const request = useMemo(() => ({
    mapId,
    values,
    parentValues,
    ancestors,
    systemId: systemId ?? ''
  }), [
    ancestors, mapId, parentValues, systemId, values
  ])
  const [debouncedRequest, setDebouncedRequest] = useState(request)
  const requestFingerprint = useMemo(() => fingerprintNodeRuntimeRequest(request), [request])
  const debouncedRequestFingerprint = useMemo(() => fingerprintNodeRuntimeRequest(debouncedRequest), [debouncedRequest])

  useEffect(() => {
    if (requestFingerprint === debouncedRequestFingerprint) return undefined
    const timeout = window.setTimeout(() => setDebouncedRequest(request), debounceMs)
    return () => window.clearTimeout(timeout)
  }, [debounceMs, debouncedRequestFingerprint, request, requestFingerprint])

  const query = useNodeRuntimeResolve(debouncedRequest, enabled && Boolean(systemId))
  const model = useMemo(() => {
    if (!query.data) return undefined
    if (!query.isPlaceholderData) return query.data

    return {
      ...query.data,
      clearPaths: []
    }
  }, [query.data, query.isPlaceholderData])
  const clearPathKey = query.isPlaceholderData
    ? ''
    : query.data?.clearPaths.map((path: NodeRuntimePathDto) => path.join('.')).join('|') ?? ''

  useEffect(() => {
    if (query.isPlaceholderData) return
    if (!onClearPaths || !query.data?.clearPaths.length) return
    onClearPaths(query.data.clearPaths)
  }, [clearPathKey, onClearPaths, query.data, query.isPlaceholderData])

  return model
}
