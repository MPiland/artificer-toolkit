import { useMemo } from 'react'
import type {
  NodeRuntimeArrayGroupNodeDto,
  NodeRuntimeGroupNodeDto,
  NodeRuntimeInputNodeDto,
  NodeRuntimeNodeDto,
  NodeRuntimeObjectGroupNodeDto,
  NodeRuntimeResolveResponseDto,
  NodeRuntimeSelectInputNodeDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import type { SelectOption } from '../utils/formUtils'

export function getResolvedNode(
  runtimeModel: NodeRuntimeResolveResponseDto | undefined,
  nodeId: string
): NodeRuntimeNodeDto | undefined {
  return getResolvedNodes(runtimeModel).find((node) => node.id === nodeId)
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
  if (runtimeNode && isResolvedSelectInputNode(runtimeNode)) return runtimeNode.options
  return fallback()
}

export function isResolvedInputNode(node: NodeRuntimeNodeDto): node is NodeRuntimeInputNodeDto {
  return node.kind === 'INPUT'
}

export function isResolvedSelectInputNode(
  node: NodeRuntimeNodeDto
): node is NodeRuntimeSelectInputNodeDto {
  return node.kind === 'INPUT' && (node.type === 'SELECT_SINGLE' || node.type === 'SELECT_MULTI')
}

export function isResolvedGroupNode(node: NodeRuntimeNodeDto): node is NodeRuntimeGroupNodeDto {
  return node.kind === 'GROUP'
}

export function isResolvedObjectGroupNode(
  node: NodeRuntimeNodeDto
): node is NodeRuntimeObjectGroupNodeDto {
  return node.kind === 'GROUP' && node.groupKind === 'OBJECT'
}

export function isResolvedArrayGroupNode(
  node: NodeRuntimeNodeDto
): node is NodeRuntimeArrayGroupNodeDto {
  return node.kind === 'GROUP' && node.groupKind === 'ARRAY'
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
  return (
    runtimeModel?.steps.flatMap((step) => step.sections).flatMap((section) => section.nodes) ?? []
  )
}
