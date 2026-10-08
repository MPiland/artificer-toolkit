import type {
  NodeRuntimeArrayGroupNodeDto,
  NodeRuntimeGroupNodeDto,
  NodeRuntimeNodeDto,
  NodeRuntimeObjectGroupNodeDto
} from '@artificer-toolkit/schema/api/nodeRuntime'

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
