import { useMemo } from 'react'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { useResolvedNodeModel } from './useResolvedNodeModel'

export type VisibleAuthoringSteps = NodeRuntimeResolveResponseDto['steps']

export type VisibleAuthoringStep = VisibleAuthoringSteps[number]

export function useAuthoringResolvedModel({
  ancestors,
  debounceMs = 150,
  mapId,
  model,
  parentValues,
  resolveModel = true,
  systemId,
  values
}: {
  ancestors?: readonly Record<string, unknown>[]
  debounceMs?: number
  mapId: string
  model?: NodeRuntimeResolveResponseDto
  parentValues?: Record<string, unknown>
  resolveModel?: boolean
  systemId?: string
  values: Record<string, unknown>
}) {
  const resolvedAncestors = useMemo(() => (ancestors ? [...ancestors] : undefined), [ancestors])
  const resolution = useResolvedNodeModel({
    mapId,
    values,
    parentValues,
    ancestors: resolvedAncestors,
    systemId,
    enabled: resolveModel && !model,
    debounceMs
  })
  const activeModel = model ?? resolution.model
  const visibleSteps = useMemo(() => getVisibleAuthoringSteps(activeModel), [activeModel])

  return {
    model: activeModel,
    steps: visibleSteps,
    error: resolveModel && !model ? resolution.error : null,
    isFetching: resolution.isFetching,
    refetch: resolution.refetch
  }
}

export function getVisibleAuthoringSteps(
  model: NodeRuntimeResolveResponseDto | undefined
): VisibleAuthoringStep[] {
  return (
    model?.steps
      .map((step) => ({
        ...step,
        sections: step.sections.filter((section) => section.nodes.some((node) => node.visible))
      }))
      .filter((step) => step.sections.length > 0) ?? []
  )
}
