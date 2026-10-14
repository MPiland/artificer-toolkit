import type {
  NodeRuntimePathDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { resolveFixtureNodeRuntime } from '#test/nodeRuntimeResolver'

type Scopes = NonNullable<NodeRuntimeResolveResponseDto['scopes']>

/** Adds the child scopes the real resolver returns for every populated group in `model`. */
export async function withResolvedScopes(
  model: NodeRuntimeResolveResponseDto,
  values: object
): Promise<NodeRuntimeResolveResponseDto> {
  const scopes: Scopes = []
  await collectScopes(scopes, model, Object.fromEntries(Object.entries(values)), [])
  return { ...model, scopes }
}

async function collectScopes(
  scopes: Scopes,
  model: NodeRuntimeResolveResponseDto,
  values: Record<string, unknown>,
  basePath: NodeRuntimePathDto
) {
  for (const node of model.steps.flatMap((step) =>
    step.sections.flatMap((section) => section.nodes)
  )) {
    if (!node.visible || node.kind !== 'GROUP' || !node.childMapId) continue
    const groupValue = valueAt(values, node.path)

    if (node.groupKind === 'OBJECT') {
      if (!isRecord(groupValue) || Object.keys(groupValue).length === 0) continue
      await pushScope(scopes, node.childMapId, [...basePath, ...node.path], groupValue, values)
      continue
    }

    if (!Array.isArray(groupValue)) continue
    for (const [index, row] of groupValue.entries()) {
      if (!isRecord(row) || Object.keys(row).length === 0) continue
      await pushScope(scopes, node.childMapId, [...basePath, ...node.path, index], row, values)
    }
  }
}

async function pushScope(
  scopes: Scopes,
  mapId: string,
  path: NodeRuntimePathDto,
  values: Record<string, unknown>,
  parentValues: Record<string, unknown>
) {
  const childModel = await resolveFixtureNodeRuntime({ mapId, parentValues, values })

  scopes.push({ mapId: childModel.mapId, path, steps: childModel.steps, clearPaths: [] })
  await collectScopes(scopes, childModel, values, path)
}

function valueAt(values: Record<string, unknown>, path: NodeRuntimePathDto): unknown {
  return path.reduce<unknown>(
    (current, segment) =>
      current !== null && typeof current === 'object'
        ? (current as Record<string | number, unknown>)[segment]
        : undefined,
    values
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
