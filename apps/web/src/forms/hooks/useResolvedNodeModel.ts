import { useEffect, useMemo, useState } from 'react'
import type { NodeRuntimePathDto, NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { useNodeRuntimeResolve } from '#app/data/nodeRuntime/queries'

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
    systemId
  }), [
    ancestors, mapId, parentValues, systemId, values
  ])
  const [debouncedRequest, setDebouncedRequest] = useState(request)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedRequest(request), debounceMs)
    return () => window.clearTimeout(timeout)
  }, [debounceMs, request])

  const query = useNodeRuntimeResolve(debouncedRequest, enabled)
  const clearPathKey = query.data?.clearPaths.map((path: NodeRuntimePathDto) => path.join('.')).join('|') ?? ''

  useEffect(() => {
    if (!onClearPaths || !query.data?.clearPaths.length) return
    onClearPaths(query.data.clearPaths)
  }, [clearPathKey, onClearPaths, query.data])

  return query.data
}
