import { useMemo } from 'react'
import type { NodeRuntimeNodeDto, NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import type { SelectOption } from '../utils/formUtils'

export function getResolvedNode(
  runtimeModel: NodeRuntimeResolveResponseDto | undefined,
  nodeId: string
): NodeRuntimeNodeDto | undefined {
  return getResolvedNodes(runtimeModel)
    .find((node) => node.id === nodeId)
}

export function getResolvedNodeOptions(
  runtimeModel: NodeRuntimeResolveResponseDto | undefined,
  nodeId: string,
  fallback: SelectOption[]
): SelectOption[] {
  return resolveResolvedNodeOptions(getResolvedNode(runtimeModel, nodeId), () => fallback)
}

export function getResolvedNodeVisible(
  runtimeModel: NodeRuntimeResolveResponseDto | undefined,
  nodeId: string,
  fallback = true
): boolean {
  return getResolvedNode(runtimeModel, nodeId)?.visible ?? fallback
}

export function getResolvedNodeRequired(
  runtimeModel: NodeRuntimeResolveResponseDto | undefined,
  nodeId: string
): boolean | undefined {
  return getResolvedNode(runtimeModel, nodeId)?.required
}

export function resolveResolvedNodeOptions(
  runtimeNode: NodeRuntimeNodeDto | undefined,
  fallback: () => SelectOption[]
): SelectOption[] {
  if (runtimeNode?.options) return runtimeNode.options
  return fallback()
}

export function useResolvedNodeById(runtimeModel: NodeRuntimeResolveResponseDto | undefined) {
  return useMemo(() => {
    const nodes = getResolvedNodes(runtimeModel)
    return new Map(nodes.map((node) => [node.id, node]))
  }, [runtimeModel])
}

export function getResolvedNodes(
  runtimeModel: NodeRuntimeResolveResponseDto | undefined
): NodeRuntimeNodeDto[] {
  return runtimeModel?.steps
    .flatMap((step) => step.sections)
    .flatMap((section) => section.nodes)
    ?? []
}
