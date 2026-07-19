import type {
  NodeRuntimeGroupNodeDto,
  NodeRuntimeInputNodeDto,
  NodeRuntimeOptionDto,
  NodeRuntimeSelectInputNodeDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  resolveArrayAuthoringMeta,
  resolveInputAuthoringMeta,
  resolveObjectAuthoringMeta
} from '@artificer-toolkit/shared/maps'

export function createRuntimeInputNode(
  id: string,
  path: string[],
  label: string,
  type: 'TEXT' | 'NUMBER' | 'RICH_TEXT',
  required = false
): NodeRuntimeInputNodeDto {
  return {
    id,
    path,
    label,
    kind: 'INPUT',
    type,
    visible: true,
    required,
    hiddenBehavior: 'KEEP',
    clearPaths: [],
    authoring: resolveInputAuthoringMeta(undefined)
  }
}

export function createRuntimeSelectNode(
  id: string,
  path: string[],
  label: string,
  options: NodeRuntimeOptionDto[],
  required = false,
  visibilityOrType: boolean | 'SELECT_SINGLE' | 'SELECT_MULTI' = true
): NodeRuntimeSelectInputNodeDto {
  const visible = typeof visibilityOrType === 'boolean' ? visibilityOrType : true
  const type = typeof visibilityOrType === 'string' ? visibilityOrType : 'SELECT_SINGLE'

  return {
    id,
    path,
    label,
    kind: 'INPUT',
    type,
    visible,
    required,
    hiddenBehavior: 'KEEP',
    clearPaths: [],
    options,
    authoring: resolveInputAuthoringMeta(undefined)
  }
}

export function createRuntimeGroupNode(
  id: string,
  path: string[],
  label: string,
  groupKind: 'OBJECT' | 'ARRAY',
  childMapId: string
): NodeRuntimeGroupNodeDto {
  if (groupKind === 'ARRAY') {
    return {
      id,
      path,
      label,
      kind: 'GROUP',
      groupKind,
      childMapId,
      presentation: 'inline',
      visible: true,
      required: false,
      hiddenBehavior: 'KEEP',
      clearPaths: [],
      authoring: resolveArrayAuthoringMeta(label, 'inline', undefined, undefined)
    }
  }

  return {
    id,
    path,
    label,
    kind: 'GROUP',
    groupKind,
    childMapId,
    presentation: 'inline',
    visible: true,
    required: false,
    hiddenBehavior: 'KEEP',
    clearPaths: [],
    authoring: resolveObjectAuthoringMeta(label, undefined)
  }
}
