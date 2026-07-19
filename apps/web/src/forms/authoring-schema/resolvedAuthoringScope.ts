import type {
  NodeRuntimePathDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { parseAuthoringFieldName } from '../utils/pathUtils'

export function getResolvedAuthoringScope(
  model: NodeRuntimeResolveResponseDto | undefined,
  mapId: string,
  fieldPathPrefix?: string
): NodeRuntimeResolveResponseDto | undefined {
  if (!model) return undefined
  if (!fieldPathPrefix && model.mapId === mapId) return model

  const path = parseAuthoringFieldName(fieldPathPrefix ?? '')
  const scope = model.scopes?.find(
    (candidate) => candidate.mapId === mapId && pathsEqual(candidate.path, path)
  )
  if (!scope) return undefined

  return {
    mapId: scope.mapId,
    steps: scope.steps,
    clearPaths: scope.clearPaths,
    scopes: model.scopes
  }
}

export function isLeafAuthoringFieldGroup(model: NodeRuntimeResolveResponseDto | undefined) {
  if (!model) return false
  const visibleSections = model.steps.flatMap((step) =>
    step.sections.filter((section) => section.nodes.some((node) => node.visible))
  )
  if (visibleSections.length !== 1) return false

  const authoredNodes = visibleSections[0]?.nodes.filter(
    (node) => node.visible && node.authoring?.exposure !== 'system'
  )
  return Boolean(authoredNodes?.length && authoredNodes.every((node) => node.kind === 'INPUT'))
}

function pathsEqual(left: NodeRuntimePathDto, right: readonly (string | number)[]) {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}
