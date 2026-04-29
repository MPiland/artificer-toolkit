import type { DBLike } from '@artificer-toolkit/db'
import type {
  NodeRuntimeNormalizeValuesRequestDto,
  NodeRuntimeNormalizeValuesResponseDto,
  NodeRuntimeNodeDto,
  NodeRuntimeOptionDto,
  NodeRuntimeResolveRequestDto,
  NodeRuntimeResolveResponseDto,
  NodeRuntimeSectionDto
} from '@artificer-toolkit/schema'
import type { InlineFilter, NodeEntry, NodeSelectSource, SectionedNodeGroup } from '@artificer-toolkit/shared'
import {
  clearValuesAtPaths,
  evaluateConditionIf,
  isRuntimeRecord,
  resolveNodeMapSections,
  type NodeRuntimeScope,
  type RuntimePath
} from '@artificer-toolkit/shared'
import { executeRelationshipPlan, streamToOptions } from './relationshipExecutor.js'
import { getRuntimeNodeMap } from './mapRegistry.js'

export async function resolveNodeRuntime(
  db: DBLike,
  request: NodeRuntimeResolveRequestDto
): Promise<NodeRuntimeResolveResponseDto> {
  const nodeMap = getRuntimeNodeMap(request.mapId)
  const scope = toScope(request)
  const sections = resolveRuntimeSections(nodeMap)
  const resolvedSections: NodeRuntimeSectionDto[] = []
  const clearPaths: RuntimePath[] = []

  for (const section of sections) {
    const nodes = await resolveSectionNodes(db, section, scope, clearPaths)
    resolvedSections.push({
      id: section.id,
      label: section.label,
      order: section.order,
      nodes
    })
  }

  return {
    mapId: nodeMap.mapId,
    sections: resolvedSections,
    clearPaths
  }
}

export async function normalizeNodeRuntimeValues(
  db: DBLike,
  request: NodeRuntimeNormalizeValuesRequestDto
): Promise<NodeRuntimeNormalizeValuesResponseDto> {
  const resolved = await resolveNodeRuntime(db, request)
  const values = isRuntimeRecord(request.values) ? request.values : {}
  const normalized = clearValuesAtPaths(values, resolved.clearPaths)

  return {
    values: normalized.values,
    clearedPaths: normalized.clearedPaths
  }
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
  const required = visible && (
    node.kind === 'INPUT'
      ? node.requiredIf === true || evaluateConditionIf(node.requiredIf, scope)
      : false
  )
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
    return {
      ...baseNode,
      groupKind: node.groupKind
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

function resolveRuntimeSections(
  nodeMap: ReturnType<typeof getRuntimeNodeMap>
): SectionedNodeGroup<Record<string, unknown>>[] {
  const sections = resolveNodeMapSections(nodeMap)
  if (sections.length > 0) return sections

  return [{
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
  }]
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
