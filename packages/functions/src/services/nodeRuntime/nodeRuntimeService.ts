import type { DBLike } from '@artificer-toolkit/db'
import type {
  NodeRuntimeNormalizeValuesRequestDto,
  NodeRuntimeNormalizeValuesResponseDto,
  NodeRuntimeNodeDto,
  NodeRuntimeOptionDto,
  NodeRuntimeResolveRequestDto,
  NodeRuntimeResolveResponseDto,
  NodeRuntimeSectionDto,
  NodeRuntimeStepDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import type { InlineFilter, NodeEntry, NodeSelectSource } from '@artificer-toolkit/shared/maps'
import {
  clearValuesAtPaths,
  evaluateConditionIf,
  getValueAtPath,
  isRuntimeRecord,
  resolveNodeMapSteps,
  type NodeRuntimeScope,
  type RuntimePath,
  type SectionedNodeGroup,
  type SteppedNodeGroup
} from '@artificer-toolkit/shared/utils'
import { executeRelationshipPlan, streamToOptions } from './relationshipExecutor.js'
import { getRuntimeNodeMap } from './mapRegistry.js'

export async function resolveNodeRuntime(
  db: DBLike,
  request: NodeRuntimeResolveRequestDto
): Promise<NodeRuntimeResolveResponseDto> {
  const nodeMap = getRuntimeNodeMap(request.mapId)
  const scope = toScope(request)
  const steps = resolveRuntimeSteps(nodeMap)
  const resolvedSteps: NodeRuntimeStepDto[] = []
  const clearPaths: RuntimePath[] = []

  for (const step of steps) {
    const resolvedSections: NodeRuntimeSectionDto[] = []

    for (const section of step.sections) {
      const nodes = await resolveSectionNodes(db, section, scope, clearPaths)
      resolvedSections.push({
        id: section.id,
        label: section.label,
        order: section.order,
        nodes
      })
    }

    resolvedSteps.push({
      id: step.id,
      label: step.label,
      order: step.order,
      sections: resolvedSections
    })
  }

  return {
    mapId: nodeMap.mapId,
    steps: resolvedSteps,
    clearPaths
  }
}

export async function normalizeNodeRuntimeValues(
  db: DBLike,
  request: NodeRuntimeNormalizeValuesRequestDto
): Promise<NodeRuntimeNormalizeValuesResponseDto> {
  const resolved = await resolveNodeRuntime(db, request)
  const values = isRuntimeRecord(request.values) ? request.values : {}
  const optionNormalized = normalizeVisibleSelectOptions(values, resolved.steps)
  const normalized = clearValuesAtPaths(optionNormalized.values, resolved.clearPaths)

  return {
    values: normalized.values,
    clearedPaths: [
      ...optionNormalized.clearedPaths,
      ...normalized.clearedPaths
    ]
  }
}

function normalizeVisibleSelectOptions(
  values: Record<string, unknown>,
  steps: readonly NodeRuntimeStepDto[]
): { values: Record<string, unknown>, clearedPaths: RuntimePath[] } {
  let nextValues = values
  const clearedPaths: RuntimePath[] = []

  for (const step of steps) {
    for (const section of step.sections) {
      for (const node of section.nodes) {
        if (!node.visible || node.kind !== 'INPUT') continue
        if (node.type !== 'SELECT_SINGLE' && node.type !== 'SELECT_MULTI') continue

        const allowedValues = new Set((node.options ?? []).map((option) => option.value))
        if (allowedValues.size === 0) continue

        const currentValue = getValueAtPath(nextValues, node.path)

        if (node.type === 'SELECT_SINGLE') {
          if (currentValue == null || currentValue === '') continue
          if (typeof currentValue === 'string' && allowedValues.has(currentValue)) continue

          const normalized = clearValuesAtPaths(nextValues, [node.path])
          nextValues = normalized.values
          if (normalized.clearedPaths.length > 0) clearedPaths.push(node.path)
          continue
        }

        if (!Array.isArray(currentValue)) continue

        const nextArrayValue = currentValue.filter((value): value is string => {
          return typeof value === 'string' && allowedValues.has(value)
        })

        if (nextArrayValue.length === currentValue.length) continue

        nextValues = setValueAtPath(nextValues, node.path, nextArrayValue)
        clearedPaths.push(node.path)
      }
    }
  }

  return { values: nextValues, clearedPaths }
}

function setValueAtPath(
  source: Record<string, unknown>,
  path: RuntimePath,
  value: unknown
): Record<string, unknown> {
  const nextValue = setValueAtPathSegment(source, path, value)
  return isRuntimeRecord(nextValue) ? nextValue : source
}

function setValueAtPathSegment(source: unknown, path: RuntimePath, value: unknown): unknown {
  if (path.length === 0) return value

  const [head, ...tail] = path

  if (typeof head === 'number') {
    const nextArray = Array.isArray(source) ? [...source] : []
    nextArray[head] = setValueAtPathSegment(nextArray[head], tail, value)
    return nextArray
  }

  const nextRecord = isRuntimeRecord(source) ? { ...source } : {}
  nextRecord[head] = setValueAtPathSegment(nextRecord[head], tail, value)
  return nextRecord
}

async function resolveSectionNodes(
  db: DBLike,
  section: SectionedNodeGroup<Record<string, unknown>>,
  scope: NodeRuntimeScope,
  clearPaths: RuntimePath[]
): Promise<NodeRuntimeNodeDto[]> {
  const nodes: NodeRuntimeNodeDto[] = []

  for (const entry of section.nodes) {
    nodes.push(await resolveNode(db, entry.id, entry.node, scope, clearPaths))
  }

  return nodes
}

async function resolveNode(
  db: DBLike,
  id: string,
  node: NodeEntry<Record<string, unknown>>,
  scope: NodeRuntimeScope,
  clearPaths: RuntimePath[]
): Promise<NodeRuntimeNodeDto> {
  const visible = evaluateConditionIf(node.showIf, scope)
  const required = visible
    && (node.requiredIf === true || (node.requiredIf !== undefined && evaluateConditionIf(node.requiredIf, scope)))
  const nodeClearPaths = visible || node.hiddenBehavior !== 'CLEAR' ? [] : [node.path]
  clearPaths.push(...nodeClearPaths)

  const baseNode = {
    id,
    path: [...node.path],
    label: node.label,
    kind: node.kind,
    visible,
    required,
    hiddenBehavior: node.hiddenBehavior,
    clearPaths: nodeClearPaths
  } satisfies Omit<NodeRuntimeNodeDto, 'type' | 'groupKind' | 'options'>

  if (node.kind === 'GROUP') {
    const childMap = typeof node.nodes === 'function' ? node.nodes() : node.nodes

    return {
      ...baseNode,
      groupKind: node.groupKind,
      childMapId: childMap.mapId
    }
  }

  if (node.type === 'SELECT_SINGLE' || node.type === 'SELECT_MULTI') {
    return {
      ...baseNode,
      type: node.type,
      options: visible ? await resolveOptions(db, node.source, scope) : []
    }
  }

  return {
    ...baseNode,
    type: node.type
  }
}

async function resolveOptions(
  db: DBLike,
  source: NodeSelectSource,
  scope: NodeRuntimeScope
): Promise<NodeRuntimeOptionDto[]> {
  if (source.kind === 'DATA') {
    return streamToOptions(await executeRelationshipPlan(db, source.relationship, scope))
  }

  if ('options' in source) {
    return applyInlineFilter(db, toOptions(source.options), source.filter, scope)
  }

  const groups = source.optionGroups.filter((group) => evaluateConditionIf(group.showIf, scope))
  const optionSets = await Promise.all(groups.map(async (group) => {
    return applyInlineFilter(db, toOptions(group.options), group.filter, scope)
  }))

  return dedupeOptions(optionSets.flat())
}

async function applyInlineFilter(
  db: DBLike,
  options: readonly NodeRuntimeOptionDto[],
  filter: InlineFilter | undefined,
  scope: NodeRuntimeScope
): Promise<NodeRuntimeOptionDto[]> {
  if (!filter) return [...options]

  const allowedValues = new Set(
    (await executeRelationshipPlan(db, filter.by, scope)).map((value) => String(value))
  )

  return options.filter((option) => {
    const isMatched = allowedValues.has(option.value)
    return filter.kind === 'ALLOW' ? isMatched : !isMatched
  })
}

function toScope(request: NodeRuntimeResolveRequestDto): NodeRuntimeScope {
  return {
    values: request.values,
    parentValues: request.parentValues,
    ancestors: request.ancestors
  }
}

function resolveRuntimeSteps(
  nodeMap: ReturnType<typeof getRuntimeNodeMap>
): SteppedNodeGroup<Record<string, unknown>>[] {
  const steps = resolveNodeMapSteps(nodeMap)
  if (steps.length > 0) return steps

  const defaultSection: SectionedNodeGroup<Record<string, unknown>> = {
    id: 'default',
    label: 'Details',
    order: 10,
    nodes: Object.entries(nodeMap.nodes)
      .sort(([, left], [, right]) => (left.order ?? 0) - (right.order ?? 0))
      .map(([id, node]) => ({
        id,
        node,
        section: { id: 'default', label: 'Details', order: 10 }
      }))
  }

  return [
    {
      id: 'default',
      label: 'Details',
      order: 10,
      sections: [defaultSection]
    }
  ]
}

function toOptions(options: readonly { code: unknown, label: string, tooltip?: string | null, description?: string | null }[]): NodeRuntimeOptionDto[] {
  return options.map((option) => ({
    value: String(option.code),
    label: option.label,
    description: option.tooltip ?? option.description ?? undefined
  }))
}

function dedupeOptions(options: readonly NodeRuntimeOptionDto[]): NodeRuntimeOptionDto[] {
  const seen = new Set<string>()
  return options.filter((option) => {
    if (seen.has(option.value)) return false
    seen.add(option.value)
    return true
  })
}
