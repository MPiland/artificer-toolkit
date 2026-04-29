import { useMemo } from 'react'
import type { NodeRuntimeNodeDto, NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema'
import type { SelectOption } from '../utils/formUtils'

export function getRuntimeNode(
  runtimeModel: NodeRuntimeResolveResponseDto | undefined,
  nodeId: string
): NodeRuntimeNodeDto | undefined {
  return runtimeModel?.sections
    .flatMap((section) => section.nodes)
    .find((node) => node.id === nodeId)
}

export function getRuntimeNodeOptions(
  runtimeModel: NodeRuntimeResolveResponseDto | undefined,
  nodeId: string,
  fallback: SelectOption[]
): SelectOption[] {
  return resolveRuntimeOptions(getRuntimeNode(runtimeModel, nodeId), () => fallback)
}

export function getRuntimeNodeVisible(
  runtimeModel: NodeRuntimeResolveResponseDto | undefined,
  nodeId: string,
  fallback = true
): boolean {
  return getRuntimeNode(runtimeModel, nodeId)?.visible ?? fallback
}

export function getRuntimeNodeRequired(
  runtimeModel: NodeRuntimeResolveResponseDto | undefined,
  nodeId: string
): boolean | undefined {
  return getRuntimeNode(runtimeModel, nodeId)?.required
}

export function resolveRuntimeOptions(
  runtimeNode: NodeRuntimeNodeDto | undefined,
  fallback: () => SelectOption[]
): SelectOption[] {
  if (runtimeNode?.options) return runtimeNode.options
  return fallback()
}

export function useRuntimeNodeById(runtimeModel: NodeRuntimeResolveResponseDto | undefined) {
  return useMemo(() => {
    const nodes = runtimeModel?.sections.flatMap((section) => section.nodes) ?? []
    return new Map(nodes.map((node) => [node.id, node]))
  }, [runtimeModel])
}
