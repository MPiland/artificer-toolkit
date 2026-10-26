import type { NodeRuntimeSourceReader } from './nodeRuntimeSourceContract.js'
import {
  nodeRuntimeNormalizeValuesRequestDtoSchema,
  nodeRuntimeResolveRequestDtoSchema,
  type NodeRuntimeNormalizeValuesRequestDto,
  type NodeRuntimeNormalizeValuesResponseDto,
  type NodeRuntimeNodeDto,
  type NodeRuntimeOptionDto,
  type NodeRuntimeResolvedScopeDto,
  type NodeRuntimeResolveRequestDto,
  type NodeRuntimeResolveResponseDto,
  type NodeRuntimeSectionDto,
  type NodeRuntimeStepDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import type {
  ArrayGroupPresentation,
  InlineFilter,
  NodeArrayAuthoringMeta,
  RuntimeNodeEntry,
  RuntimeNodeMap,
  NodeSelectSource
} from '@artificer-toolkit/shared/maps'
import {
  clearValuesAtPaths,
  evaluateConditionIf,
  getValueAtPath,
  resolveLocalCollectionOptions,
  isRuntimeRecord,
  resolveArrayAuthoringMeta,
  resolveInputAuthoringMeta,
  resolveNodeMapSteps,
  resolveObjectAuthoringMeta,
  type NodeRuntimeScope,
  type RuntimePath,
  type SectionedNodeGroup,
  type SteppedNodeGroup
} from '@artificer-toolkit/shared/utils'
import { executeRelationshipPlan, streamToOptions } from './relationshipExecutor.js'
import { getRuntimeNodeMap } from './mapRegistry.js'
import { systemCoreCodeTables } from './systemSourceRows.js'

type NodeRuntimeReader = NodeRuntimeSourceReader

type NormalizedValues = {
  values: Record<string, unknown>
  clearedPaths: RuntimePath[]
  refusedPaths: RuntimePath[]
}

const coreCodeTables = new Set<string>(systemCoreCodeTables)

export async function resolveNodeRuntime(
  db: NodeRuntimeReader,
  request: NodeRuntimeResolveRequestDto
): Promise<NodeRuntimeResolveResponseDto> {
  const parsedRequest = nodeRuntimeResolveRequestDtoSchema.parse(request)
  const resolved = await resolveNodeRuntimeScope(db, parsedRequest)
  const scopes = await resolveNestedRuntimeScopes(db, parsedRequest, resolved.steps)

  return {
    ...resolved,
    scopes
  }
}

async function resolveNodeRuntimeScope(
  db: NodeRuntimeReader,
  request: NodeRuntimeResolveRequestDto
): Promise<ResolvedRuntimeScope> {
  const scope = toScope(request)
  const nodeMap = await expandKeyedNodes(db, getRuntimeNodeMap(request.mapId), scope)
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
      description: step.description,
      order: step.order,
      sections: resolvedSections
    })
  }

  const effectiveClearPaths = removePathsOwnedByVisibleNodes(clearPaths, resolvedSteps)

  return {
    mapId: nodeMap.mapId,
    steps: reconcileNodeClearPaths(resolvedSteps, effectiveClearPaths),
    clearPaths: effectiveClearPaths
  }
}

/** A map keyed by a System table gets one node per row of the request's System, in row order. */
async function expandKeyedNodes(
  db: NodeRuntimeReader,
  nodeMap: RuntimeNodeMap,
  scope: NodeRuntimeScope
): Promise<RuntimeNodeMap> {
  if (!nodeMap.keyedBy) return nodeMap
  const { rows, entry } = nodeMap.keyedBy
  const options = streamToOptions(await executeRelationshipPlan(db, rows, scope))
  return {
    ...nodeMap,
    nodes: Object.fromEntries(
      options.map(({ value, label }, index): [string, RuntimeNodeEntry] => [
        value,
        { ...entry, path: [value], label, order: (index + 1) * 10 }
      ])
    )
  }
}

/** The scopes of every populated nested group under `steps`, as `resolveNodeRuntime` returns them. */
export async function resolveNestedRuntimeScopes(
  db: NodeRuntimeReader,
  request: NodeRuntimeResolveRequestDto,
  steps: readonly NodeRuntimeStepDto[],
  parentPath: RuntimePath = []
): Promise<NodeRuntimeResolvedScopeDto[]> {
  const scopes: NodeRuntimeResolvedScopeDto[] = []

  for (const step of steps) {
    for (const section of step.sections) {
      for (const node of section.nodes) {
        if (!node.visible || node.kind !== 'GROUP' || !node.childMapId) continue

        const groupValue = getValueAtPath(request.values, node.path)
        const childAncestors = [request.values, ...(request.ancestors ?? [])]

        if (node.groupKind === 'OBJECT') {
          // An empty keyed object still has its System's rows to author.
          const keyed = isRuntimeRecord(groupValue) && getRuntimeNodeMap(node.childMapId).keyedBy
          if (!isPopulatedRuntimeRecord(groupValue) && !keyed) continue

          const childPath = [...parentPath, ...node.path]
          const childRequest = {
            mapId: node.childMapId,
            values: groupValue,
            parentValues: request.values,
            ancestors: childAncestors,
            systemId: request.systemId
          }
          const child = await resolveNodeRuntimeScope(db, childRequest)

          scopes.push({
            mapId: child.mapId,
            path: childPath,
            steps: child.steps,
            clearPaths: child.clearPaths
          })
          scopes.push(
            ...(await resolveNestedRuntimeScopes(db, childRequest, child.steps, childPath))
          )
          continue
        }

        if (!Array.isArray(groupValue)) continue

        for (const [index, row] of groupValue.entries()) {
          if (!isPopulatedRuntimeRecord(row)) continue

          const childPath = [...parentPath, ...node.path, index]
          const childRequest = {
            mapId: node.childMapId,
            values: row,
            parentValues: request.values,
            ancestors: childAncestors,
            systemId: request.systemId
          }
          const child = await resolveNodeRuntimeScope(db, childRequest)

          scopes.push({
            mapId: child.mapId,
            path: childPath,
            steps: child.steps,
            clearPaths: child.clearPaths
          })
          scopes.push(
            ...(await resolveNestedRuntimeScopes(db, childRequest, child.steps, childPath))
          )
        }
      }
    }
  }

  return scopes
}

function isPopulatedRuntimeRecord(value: unknown): value is Record<string, unknown> {
  return isRuntimeRecord(value) && Object.keys(value).length > 0
}

function reconcileNodeClearPaths(
  steps: readonly NodeRuntimeStepDto[],
  clearPaths: readonly RuntimePath[]
): NodeRuntimeStepDto[] {
  const effectivePaths = new Set(clearPaths.map((path) => JSON.stringify(path)))

  return steps.map((step) => ({
    ...step,
    sections: step.sections.map((section) => ({
      ...section,
      nodes: section.nodes.map((node) => ({
        ...node,
        clearPaths: node.clearPaths.filter((path) => effectivePaths.has(JSON.stringify(path)))
      }))
    }))
  }))
}

function removePathsOwnedByVisibleNodes(
  clearPaths: readonly RuntimePath[],
  steps: readonly NodeRuntimeStepDto[]
): RuntimePath[] {
  const visiblePaths = new Set<string>()

  for (const step of steps) {
    for (const section of step.sections) {
      for (const node of section.nodes) {
        if (node.visible) visiblePaths.add(JSON.stringify(node.path))
      }
    }
  }

  const retained = new Map<string, RuntimePath>()
  for (const path of clearPaths) {
    const key = JSON.stringify(path)
    if (!visiblePaths.has(key)) retained.set(key, path)
  }

  return [...retained.values()]
}

export async function normalizeNodeRuntimeValues(
  db: NodeRuntimeReader,
  request: NodeRuntimeNormalizeValuesRequestDto
): Promise<NodeRuntimeNormalizeValuesResponseDto> {
  return normalizeParsedValues(db, nodeRuntimeNormalizeValuesRequestDtoSchema.parse(request))
}

/**
 * Normalizes an authored document at ingress (publication, import staging): it refuses a value that
 * names a System core code the System does not list, where an editor's normalization clears it.
 */
export async function normalizeIngressValues(
  db: NodeRuntimeReader,
  request: NodeRuntimeNormalizeValuesRequestDto
): Promise<NodeRuntimeNormalizeValuesResponseDto> {
  const normalized = await normalizeNodeRuntimeValues(db, request)
  const [refused] = normalized.refusedPaths
  if (refused) {
    const value = isRuntimeRecord(request.values) ? getValueAtPath(request.values, refused) : null
    throw new Error(
      `The Game System does not define ${JSON.stringify(value)} at ${refused.join('.')}.`
    )
  }
  return normalized
}

// Group rows recurse here: the root request already passed the size and depth limits, and parsing
// each child again would re-walk and re-serialize the whole record, its parent and its ancestors.
async function normalizeParsedValues(
  db: NodeRuntimeReader,
  parsedRequest: NodeRuntimeNormalizeValuesRequestDto
): Promise<NormalizedValues> {
  const resolved = await resolveNodeRuntimeScope(db, parsedRequest)
  const keyedNormalized = normalizeKeyedEntries(
    parsedRequest.mapId,
    isRuntimeRecord(parsedRequest.values) ? parsedRequest.values : {},
    resolved.steps
  )
  const optionNormalized = normalizeVisibleSelectOptions(keyedNormalized.values, resolved.steps)
  const hiddenNormalized = clearValuesAtPaths(optionNormalized.values, resolved.clearPaths)
  const nestedNormalized = await normalizeVisibleGroups(
    db,
    hiddenNormalized.values,
    resolved.steps,
    parsedRequest
  )

  return {
    values: nestedNormalized.values,
    clearedPaths: [
      ...keyedNormalized.clearedPaths,
      ...optionNormalized.clearedPaths,
      ...hiddenNormalized.clearedPaths,
      ...nestedNormalized.clearedPaths
    ],
    refusedPaths: [
      ...keyedNormalized.refusedPaths,
      ...optionNormalized.refusedPaths,
      ...nestedNormalized.refusedPaths
    ]
  }
}

// A keyed map's keys are its table's rows: a key the System does not list is cleared, and refused
// when the table holds System core codes.
function normalizeKeyedEntries(
  mapId: string,
  values: Record<string, unknown>,
  steps: readonly NodeRuntimeStepDto[]
): NormalizedValues {
  const keyedBy = getRuntimeNodeMap(mapId).keyedBy
  if (!keyedBy) return { values, clearedPaths: [], refusedPaths: [] }
  const keys = new Set(
    steps.flatMap((step) => step.sections.flatMap((section) => section.nodes.map(({ id }) => id)))
  )
  const unknownPaths = Object.keys(values)
    .filter((key) => !keys.has(key))
    .map((key): RuntimePath => [key])
  return {
    values: Object.fromEntries(Object.entries(values).filter(([key]) => keys.has(key))),
    clearedPaths: unknownPaths,
    refusedPaths: coreCodeTables.has(keyedBy.rows.table) ? unknownPaths : []
  }
}

function normalizeVisibleSelectOptions(
  values: Record<string, unknown>,
  steps: readonly NodeRuntimeStepDto[]
): NormalizedValues {
  let nextValues = values
  const clearedPaths: RuntimePath[] = []
  const refusedPaths: RuntimePath[] = []

  for (const step of steps) {
    for (const section of step.sections) {
      for (const node of section.nodes) {
        if (!node.visible || node.kind !== 'INPUT') continue
        if (
          node.type !== 'SELECT_SINGLE' &&
          node.type !== 'SELECT_NUMBER' &&
          node.type !== 'SELECT_MULTI'
        ) {
          continue
        }
        if (node.unknownOptions === 'PRESERVE') continue
        const clear = (path: RuntimePath) => {
          clearedPaths.push(path)
          if (node.unknownOptions === 'REFUSE') refusedPaths.push(path)
        }

        const allowedValues = new Set((node.options ?? []).map((option) => option.value))
        const currentValue = getValueAtPath(nextValues, node.path)

        if (node.type === 'SELECT_SINGLE' || node.type === 'SELECT_NUMBER') {
          if (currentValue == null || currentValue === '') continue
          if (
            ((node.type === 'SELECT_SINGLE' && typeof currentValue === 'string') ||
              (node.type === 'SELECT_NUMBER' && typeof currentValue === 'number')) &&
            allowedValues.has(String(currentValue))
          ) {
            continue
          }

          const normalized = clearValuesAtPaths(nextValues, [node.path])
          nextValues = normalized.values
          if (normalized.clearedPaths.length > 0) clear(node.path)
          continue
        }

        if (!Array.isArray(currentValue)) continue

        const nextArrayValue = currentValue.filter((value): value is string => {
          return typeof value === 'string' && allowedValues.has(value)
        })

        if (nextArrayValue.length === currentValue.length) continue

        nextValues = setValueAtPath(nextValues, node.path, nextArrayValue)
        clear(node.path)
      }
    }
  }

  return { values: nextValues, clearedPaths, refusedPaths }
}

async function normalizeVisibleGroups(
  db: NodeRuntimeReader,
  values: Record<string, unknown>,
  steps: readonly NodeRuntimeStepDto[],
  request: NodeRuntimeNormalizeValuesRequestDto
): Promise<NormalizedValues> {
  let nextValues = values
  const clearedPaths: RuntimePath[] = []
  const refusedPaths: RuntimePath[] = []

  for (const step of steps) {
    for (const section of step.sections) {
      for (const node of section.nodes) {
        if (!node.visible || node.kind !== 'GROUP' || !node.childMapId) continue

        const childMapId = node.childMapId
        const groupValue = getValueAtPath(nextValues, node.path)
        const childAncestors = [nextValues, ...(request.ancestors ?? [])]

        if (node.groupKind === 'OBJECT') {
          if (!isRuntimeRecord(groupValue)) continue

          const child = await normalizeParsedValues(db, {
            mapId: childMapId,
            values: groupValue,
            parentValues: nextValues,
            ancestors: childAncestors,
            systemId: request.systemId
          })
          nextValues = setValueAtPath(nextValues, node.path, child.values)
          clearedPaths.push(...child.clearedPaths.map((path) => [...node.path, ...path]))
          refusedPaths.push(...child.refusedPaths.map((path) => [...node.path, ...path]))
          continue
        }

        if (!Array.isArray(groupValue)) continue

        const normalizedRows = await Promise.all(
          groupValue.map(async (row, index) => {
            if (!isRuntimeRecord(row)) return row

            const child = await normalizeParsedValues(db, {
              mapId: childMapId,
              values: row,
              parentValues: nextValues,
              ancestors: childAncestors,
              systemId: request.systemId
            })
            clearedPaths.push(...child.clearedPaths.map((path) => [...node.path, index, ...path]))
            refusedPaths.push(...child.refusedPaths.map((path) => [...node.path, index, ...path]))
            return child.values
          })
        )

        nextValues = setValueAtPath(nextValues, node.path, normalizedRows)
      }
    }
  }

  return { values: nextValues, clearedPaths, refusedPaths }
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
  db: NodeRuntimeReader,
  section: SectionedNodeGroup,
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
  db: NodeRuntimeReader,
  id: string,
  node: RuntimeNodeEntry,
  scope: NodeRuntimeScope,
  clearPaths: RuntimePath[]
): Promise<NodeRuntimeNodeDto> {
  const visible = evaluateConditionIf(node.showIf, scope)
  const required =
    visible &&
    (node.requiredIf === true ||
      (node.requiredIf !== undefined && evaluateConditionIf(node.requiredIf, scope)))
  const nodeClearPaths = visible || node.hiddenBehavior !== 'CLEAR' ? [] : [node.path]
  clearPaths.push(...nodeClearPaths)

  const baseNode = {
    id,
    path: [...node.path],
    label: node.label,
    visible,
    required,
    hiddenBehavior: node.hiddenBehavior ?? 'KEEP',
    clearPaths: nodeClearPaths
  }

  if (node.kind === 'GROUP') {
    const childMap = typeof node.nodes === 'function' ? node.nodes() : node.nodes

    if (node.groupKind === 'OBJECT') {
      return {
        ...baseNode,
        kind: 'GROUP',
        groupKind: 'OBJECT',
        presentation: node.presentation,
        childMapId: childMap.mapId,
        authoring: resolveObjectAuthoringMeta(node.label, node.authoring)
      }
    }

    return {
      ...baseNode,
      kind: 'GROUP',
      groupKind: 'ARRAY',
      presentation: node.presentation as ArrayGroupPresentation,
      childMapId: childMap.mapId,
      authoring: resolveArrayAuthoringMeta(
        node.label,
        node.presentation as ArrayGroupPresentation,
        node.authoring as NodeArrayAuthoringMeta | undefined,
        childMap.authoring
      )
    }
  }

  if (
    node.type === 'SELECT_SINGLE' ||
    node.type === 'SELECT_NUMBER' ||
    node.type === 'SELECT_MULTI'
  ) {
    return {
      ...baseNode,
      kind: 'INPUT',
      type: node.type,
      options: visible ? await resolveOptions(db, node.source, scope) : [],
      unknownOptions: unknownOptionsPolicy(node.source),
      constraints: node.constraints,
      authoring: resolveInputAuthoringMeta(node.authoring)
    }
  }

  return {
    ...baseNode,
    kind: 'INPUT',
    type: node.type,
    constraints: node.constraints,
    authoring: resolveInputAuthoringMeta(node.authoring)
  }
}

// A data source keeps an unknown value when it says so; a System core-code table refuses it.
function unknownOptionsPolicy(source: NodeSelectSource): 'PRESERVE' | 'REFUSE' | undefined {
  if (source.kind !== 'DATA') return undefined
  if (source.preserveUnknownOptions) return 'PRESERVE'
  return source.relationship.kind === 'TABLE' && coreCodeTables.has(source.relationship.table)
    ? 'REFUSE'
    : undefined
}

async function resolveOptions(
  db: NodeRuntimeReader,
  source: NodeSelectSource,
  scope: NodeRuntimeScope
): Promise<NodeRuntimeOptionDto[]> {
  switch (source.kind) {
    case 'DATA':
      return applyInlineFilter(
        db,
        streamToOptions(await executeRelationshipPlan(db, source.relationship, scope)),
        source.filter,
        scope
      )
    case 'LOCAL_COLLECTION':
      return resolveLocalCollectionOptions(source, scope)
    case 'INLINE_OPTIONS':
      return applyInlineFilter(db, toOptions(source.options), source.filter, scope)
    case 'INLINE_GROUPS': {
      const groups = source.optionGroups.filter((group) => evaluateConditionIf(group.showIf, scope))
      const optionSets = await Promise.all(
        groups.map(async (group) => {
          return applyInlineFilter(db, toOptions(group.options), group.filter, scope)
        })
      )

      return dedupeOptions(optionSets.flat())
    }
  }
}

async function applyInlineFilter(
  db: NodeRuntimeReader,
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
    systemId: request.systemId,
    values: request.values,
    parentValues: request.parentValues,
    ancestors: request.ancestors
  }
}

function resolveRuntimeSteps(nodeMap: RuntimeNodeMap): SteppedNodeGroup[] {
  const steps = resolveNodeMapSteps(nodeMap)
  if (steps.length > 0) return steps

  const defaultSection: SectionedNodeGroup = {
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

function toOptions(
  options: readonly {
    code: unknown
    label: string
    description?: string | null
  }[]
): NodeRuntimeOptionDto[] {
  return options.map((option) => ({
    value: String(option.code),
    label: option.label,
    description: option.description ?? undefined
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
type ResolvedRuntimeScope = Pick<NodeRuntimeResolveResponseDto, 'mapId' | 'steps' | 'clearPaths'>
