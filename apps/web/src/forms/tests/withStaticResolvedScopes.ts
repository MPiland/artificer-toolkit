import type {
  NodeRuntimePathDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { createStaticResolvedFormModel } from '../node-map/staticResolvedModel'
import { getAuthoringFieldValue, toAuthoringFieldName } from '../utils/pathUtils'

export function withStaticResolvedScopes(
  model: NodeRuntimeResolveResponseDto,
  values: object
): NodeRuntimeResolveResponseDto {
  const rootValues = Object.fromEntries(Object.entries(values))
  const scopes: NonNullable<NodeRuntimeResolveResponseDto['scopes']> = []

  for (const node of model.steps.flatMap((step) =>
    step.sections.flatMap((section) => section.nodes)
  )) {
    if (!node.visible || node.kind !== 'GROUP' || !node.childMapId) continue
    const childMapId = node.childMapId
    const groupValue = getAuthoringFieldValue(
      rootValues,
      toAuthoringFieldName(undefined, node.path)
    )

    if (node.groupKind === 'OBJECT') {
      if (!isRecord(groupValue) || Object.keys(groupValue).length === 0) continue
      pushScope(scopes, childMapId, node.path, groupValue, rootValues)
      continue
    }

    if (!Array.isArray(groupValue)) continue
    groupValue.forEach((row, index) => {
      if (!isRecord(row) || Object.keys(row).length === 0) return
      pushScope(scopes, childMapId, [...node.path, index], row, rootValues)
    })
  }

  return { ...model, scopes }
}

function pushScope(
  scopes: NonNullable<NodeRuntimeResolveResponseDto['scopes']>,
  mapId: string,
  path: NodeRuntimePathDto,
  values: Record<string, unknown>,
  parentValues: Record<string, unknown>
) {
  const childModel = createStaticResolvedFormModel(mapId, { values, parentValues })
  if (!childModel) return

  scopes.push({ mapId: childModel.mapId, path, steps: childModel.steps, clearPaths: [] })
  scopes.push(
    ...(childModel.scopes ?? []).map((scope) => ({
      ...scope,
      path: [...path, ...scope.path]
    }))
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
