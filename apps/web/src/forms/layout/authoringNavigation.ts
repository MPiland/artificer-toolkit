import type {
  NodeRuntimeNodeDto,
  NodeRuntimePathDto,
  NodeRuntimeResolveResponseDto,
  NodeRuntimeStepDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { createStaticResolvedFormModel } from '../node-map/staticResolvedModel'
import { getAuthoringFieldValue, toAuthoringFieldName } from '../utils/pathUtils'
import {
  getAuthoringProgress,
  type AuthoringProgressSummary,
  type AuthoringStepProgressStatus,
  type AuthoringStepStatusMap,
  type AuthoringStepWarningMap,
  type FieldMetaSnapshot
} from '../validation/authoringProgress'
import { getVisibleAuthoringSteps } from '../hooks/useAuthoringResolvedModel'
import { EFFECT_KIND_OPTIONS, PATH_CODE_OPTIONS, TRIGGER_OPTIONS } from '@artificer-toolkit/shared/core'

const SYSTEM_MANAGED_FIELD_KEYS = new Set(['id', 'order', 'systemId', 'userId'])

export type AuthoringNavigationTargetKind = 'overview' | 'step'

export type AuthoringNavigationTarget = {
  ancestors?: readonly Record<string, unknown>[]
  collectionFieldName?: string
  collectionNode?: NodeRuntimeNodeDto
  fieldPathPrefix?: string
  id: string
  kind: AuthoringNavigationTargetKind
  label: string
  mapId: string
  parentValues?: Record<string, unknown>
  stepId?: string
}

export type AuthoringNavigationNode = {
  children?: readonly AuthoringNavigationNode[]
  id: string
  label: string
  level: number
  status?: AuthoringStepProgressStatus
  target?: AuthoringNavigationTarget
}

export type AuthoringNavigationState = {
  navigationTargets: readonly AuthoringNavigationTarget[]
  navigationTree: readonly AuthoringNavigationNode[]
  progressSummary: AuthoringProgressSummary
  stepStatuses: AuthoringStepStatusMap
}

type BuildNavigationInput = {
  ancestors?: readonly Record<string, unknown>[]
  fieldMeta?: Partial<Record<string, FieldMetaSnapshot>>
  fieldPathPrefix?: string
  mapId: string
  model: NodeRuntimeResolveResponseDto
  parentValues?: Record<string, unknown>
  values: Record<string, unknown>
  warnings?: AuthoringStepWarningMap
}

type BuildNavigationContext = BuildNavigationInput & {
  targets: AuthoringNavigationTarget[]
}

type NavigationTargetIdInput = {
  fieldPathPrefix?: string
  kind: AuthoringNavigationTargetKind
  mapId: string
  stepId?: string
}

export function buildAuthoringNavigationTree({
  ancestors,
  fieldMeta,
  fieldPathPrefix,
  mapId,
  model,
  parentValues,
  values,
  warnings
}: BuildNavigationInput): AuthoringNavigationState {
  const targets: AuthoringNavigationTarget[] = []
  const context: BuildNavigationContext = {
    ancestors,
    fieldMeta,
    fieldPathPrefix,
    mapId,
    model,
    parentValues,
    targets,
    values,
    warnings
  }
  const navigationTree = withNavigationLevels(
    getVisibleAuthoringSteps(model).map((step) => buildStepNode(step, context)).filter(isNode)
  )
  const stepStatuses = Object.fromEntries(
    targets.map((target) => [target.id, getTargetStatus(target, context)])
  ) satisfies AuthoringStepStatusMap

  return {
    navigationTargets: targets,
    navigationTree: navigationTree.map((node) => withAggregatedStatus(node, stepStatuses)),
    progressSummary: getNavigationProgressSummary(targets, stepStatuses),
    stepStatuses
  }
}

export function createNavigationTargetId({
  fieldPathPrefix,
  kind,
  mapId,
  stepId
}: NavigationTargetIdInput) {
  return [
    kind,
    mapId,
    fieldPathPrefix && fieldPathPrefix.length > 0 ? fieldPathPrefix : 'root',
    stepId ?? 'overview'
  ].join(':')
}

export function getFirstArrayItemNavigationTargetId({
  collectionFieldName,
  collectionNode,
  rowIndex
}: {
  collectionFieldName: string
  collectionNode: NodeRuntimeNodeDto
  rowIndex: number
}) {
  if (!collectionNode.childMapId) return undefined

  const childModel = createStaticResolvedFormModel(collectionNode.childMapId)
  const firstStep = getVisibleAuthoringSteps(childModel)[0]
  if (!firstStep) return undefined

  return createNavigationTargetId({
    fieldPathPrefix: `${collectionFieldName}[${rowIndex}]`,
    kind: 'step',
    mapId: collectionNode.childMapId,
    stepId: firstStep.id
  })
}

function buildStepNode(
  step: NodeRuntimeStepDto,
  context: BuildNavigationContext
): AuthoringNavigationNode | undefined {
  const children: AuthoringNavigationNode[] = []
  const groupNodes = step.sections.flatMap((section) =>
    section.nodes.filter((node) => node.visible && node.kind === 'GROUP' && node.childMapId)
  )
  const arrayNodes = groupNodes.filter((node) => node.groupKind === 'ARRAY' && isNavigableArrayNode(node))
  const hasDirectContent = hasDirectEditableContent(step)

  if (hasDirectContent) {
    const directTarget = createStepTarget({
      context,
      label: getDirectStepLabel(step),
      step
    })

    children.push({
      id: directTarget.id,
      label: directTarget.label,
      level: 0,
      target: directTarget
    })
  }

  if (!hasDirectContent) {
    for (const node of arrayNodes) {
      const collectionNode = buildArrayCollectionNode(node, context, {
        emptyLabel: arrayNodes.length === 1 ? step.label : undefined
      })
      if (collectionNode) children.push(collectionNode)
    }
  }

  if (children.length === 0) return undefined
  if (children.length === 1) return children[0]

  return {
    children,
    id: `container:${context.mapId}:${context.fieldPathPrefix ?? 'root'}:${step.id}`,
    label: step.label,
    level: 0
  }
}

function buildArrayCollectionNode(
  node: NodeRuntimeNodeDto,
  context: BuildNavigationContext,
  options: {
    emptyLabel?: string
  } = {}
): AuthoringNavigationNode | undefined {
  if (!node.childMapId) return undefined

  const collectionFieldName = toAuthoringFieldName(context.fieldPathPrefix, node.path)
  const overviewTarget = createOverviewTarget({
    collectionFieldName,
    context,
    node
  })
  const rows = getArrayRows(context.values, collectionFieldName)
  if (rows.length === 0) {
    return {
      id: overviewTarget.id,
      label: options.emptyLabel ?? node.label,
      level: 0,
      target: overviewTarget
    }
  }

  const children: AuthoringNavigationNode[] = [
    {
      id: overviewTarget.id,
      label: overviewTarget.label,
      level: 0,
      target: overviewTarget
    }
  ]

  rows.forEach((row, index) => {
    const rowPrefix = `${collectionFieldName}[${index}]`
    const rowNode = buildArrayRowNode({
      context,
      index,
      node,
      row,
      rowPrefix
    })

    if (rowNode) children.push(rowNode)
  })

  return {
    children,
    id: `collection:${collectionFieldName}`,
    label: node.label,
    level: 0
  }
}

function buildArrayRowNode({
  context,
  index,
  node,
  row,
  rowPrefix
}: {
  context: BuildNavigationContext
  index: number
  node: NodeRuntimeNodeDto
  row: unknown
  rowPrefix: string
}) {
  if (!node.childMapId) return undefined

  const childModel = createStaticResolvedFormModel(node.childMapId)
  if (!childModel) return undefined
  const rowValues = getRecordObjectValue(row)
  const parentValues = getContextValues(context)
  const childAncestors = getChildAncestors(context, parentValues)
  const scopedChildModel = createStaticResolvedFormModel(node.childMapId, {
    ancestors: childAncestors,
    parentValues,
    values: rowValues ?? {}
  }) ?? childModel

  const childContext: BuildNavigationContext = {
    ...context,
    fieldPathPrefix: rowPrefix,
    mapId: node.childMapId,
    model: scopedChildModel,
    parentValues,
    ancestors: childAncestors
  }
  const children = getVisibleAuthoringSteps(scopedChildModel)
    .map((step) => buildStepNode(step, childContext))
    .filter(isNode)

  if (children.length === 0) return undefined

  return {
    children,
    id: `row:${rowPrefix}`,
    label: getRowLabel(node, row, index),
    level: 0
  } satisfies AuthoringNavigationNode
}

function createStepTarget({
  context,
  label,
  step
}: {
  context: BuildNavigationContext
  label: string
  step: NodeRuntimeStepDto
}): AuthoringNavigationTarget {
  const target = {
    fieldPathPrefix: context.fieldPathPrefix,
    ancestors: context.ancestors,
    id: createNavigationTargetId({
      fieldPathPrefix: context.fieldPathPrefix,
      kind: 'step',
      mapId: context.mapId,
      stepId: step.id
    }),
    kind: 'step',
    label,
    mapId: context.mapId,
    parentValues: context.parentValues,
    stepId: step.id
  } satisfies AuthoringNavigationTarget

  context.targets.push(target)
  return target
}

function createOverviewTarget({
  collectionFieldName,
  context,
  node
}: {
  collectionFieldName: string
  context: BuildNavigationContext
  node: NodeRuntimeNodeDto
}): AuthoringNavigationTarget {
  const target = {
    collectionFieldName,
    collectionNode: node,
    fieldPathPrefix: context.fieldPathPrefix,
    ancestors: context.ancestors,
    id: createNavigationTargetId({
      fieldPathPrefix: collectionFieldName,
      kind: 'overview',
      mapId: node.childMapId ?? context.mapId
    }),
    kind: 'overview',
    label: 'Overview',
    mapId: node.childMapId ?? context.mapId,
    parentValues: context.parentValues
  } satisfies AuthoringNavigationTarget

  context.targets.push(target)
  return target
}

function getTargetStatus(
  target: AuthoringNavigationTarget,
  context: BuildNavigationContext
): AuthoringStepProgressStatus {
  if (target.kind === 'overview') {
    const rows = target.collectionFieldName
      ? getArrayRows(context.values, target.collectionFieldName)
      : []

    return target.collectionNode?.required && rows.length === 0 ? 'incomplete' : 'complete'
  }

  const model = getTargetStepModel(target, context)
  if (!model) return 'complete'

  return getAuthoringProgress({
    fieldMeta: context.fieldMeta,
    fieldPathPrefix: target.fieldPathPrefix,
    model,
    values: context.values,
    warnings: target.stepId ? { [target.stepId]: context.warnings?.[target.stepId] } : undefined
  }).stepStatuses[target.stepId ?? ''] ?? 'complete'
}

function getTargetStepModel(
  target: AuthoringNavigationTarget,
  context: BuildNavigationContext
): NodeRuntimeResolveResponseDto | undefined {
  if (!target.stepId) return undefined

  const sourceModel =
    target.mapId === context.mapId ? context.model : createTargetStaticModel(target, context)
  const step = sourceModel?.steps.find((modelStep) => modelStep.id === target.stepId)
  if (!sourceModel || !step) return undefined

  return {
    ...sourceModel,
    steps: [step]
  }
}

function createTargetStaticModel(
  target: AuthoringNavigationTarget,
  context: BuildNavigationContext
) {
  return createStaticResolvedFormModel(target.mapId, {
    ancestors: target.ancestors,
    parentValues: target.parentValues,
    values: getTargetValues(target, context)
  })
}

function getNavigationProgressSummary(
  targets: readonly AuthoringNavigationTarget[],
  stepStatuses: AuthoringStepStatusMap
): AuthoringProgressSummary {
  let completeCount = 0
  let errorCount = 0
  let incompleteCount = 0
  let warningCount = 0

  for (const target of targets) {
    const status = stepStatuses[target.id]
    if (status === 'complete') completeCount += 1
    if (status === 'error') errorCount += 1
    if (status === 'incomplete') incompleteCount += 1
    if (status === 'warning') warningCount += 1
  }

  return {
    completeCount,
    errorCount,
    incompleteCount,
    stepCount: targets.length,
    warningCount
  }
}

function withAggregatedStatus(
  node: AuthoringNavigationNode,
  stepStatuses: AuthoringStepStatusMap
): AuthoringNavigationNode {
  if (node.target) {
    return {
      ...node,
      status: stepStatuses[node.target.id]
    }
  }

  const children = node.children?.map((child) => withAggregatedStatus(child, stepStatuses)) ?? []

  return {
    ...node,
    children,
    status: aggregateProgressStatus(children.map((child) => child.status))
  }
}

function aggregateProgressStatus(
  statuses: readonly (AuthoringStepProgressStatus | undefined)[]
): AuthoringStepProgressStatus | undefined {
  if (statuses.length === 0) return undefined
  if (statuses.includes('error')) return 'error'
  if (statuses.includes('warning')) return 'warning'
  if (statuses.includes('incomplete')) return 'incomplete'
  if (statuses.every((status) => status === 'complete')) return 'complete'
  return undefined
}

function withNavigationLevels(
  nodes: readonly AuthoringNavigationNode[],
  level = 0
): readonly AuthoringNavigationNode[] {
  return nodes.map((node) => ({
    ...node,
    children: node.children ? withNavigationLevels(node.children, level + 1) : undefined,
    level
  }))
}

function getDirectStepLabel(step: NodeRuntimeStepDto) {
  const firstSection = step.sections[0]
  if (firstSection && normalizeLabel(firstSection.label) !== normalizeLabel(step.label)) {
    return firstSection.label
  }

  return step.label
}

function hasDirectEditableContent(step: NodeRuntimeStepDto) {
  return step.sections.some((section) =>
    section.nodes.some((node) => {
      if (!node.visible) return false
      if (node.kind === 'INPUT') return !isSystemManagedFieldNode(node)
      if (node.kind !== 'GROUP') return false
      if (node.groupKind === 'OBJECT') return true
      return node.groupKind === 'ARRAY' && !isNavigableArrayNode(node)
    })
  )
}

function isNavigableArrayNode(node: NodeRuntimeNodeDto) {
  if (node.kind !== 'GROUP' || node.groupKind !== 'ARRAY' || !node.childMapId) return false

  const childModel = createStaticResolvedFormModel(node.childMapId)
  if (!childModel) return false

  return childModel.steps.some((step) =>
    step.sections.some((section) =>
      section.nodes.some((childNode) =>
        childNode.visible && childNode.kind === 'GROUP' && Boolean(childNode.childMapId)
      )
    )
  )
}

function isSystemManagedFieldNode(node: NodeRuntimeNodeDto) {
  if (node.kind !== 'INPUT') return false

  const fieldKey = node.path[node.path.length - 1]
  return typeof fieldKey === 'string' && SYSTEM_MANAGED_FIELD_KEYS.has(fieldKey)
}

function getArrayRows(values: Record<string, unknown>, fieldName: string) {
  const value = getAuthoringFieldValue(values, fieldName)
  return Array.isArray(value) ? value : []
}

function getTargetValues(
  target: AuthoringNavigationTarget,
  context: BuildNavigationContext
) {
  if (!target.fieldPathPrefix) return context.values

  return getRecordObjectValue(getAuthoringFieldValue(context.values, target.fieldPathPrefix)) ?? {}
}

function getContextValues(context: BuildNavigationContext) {
  if (!context.fieldPathPrefix) return context.values

  return getRecordObjectValue(getAuthoringFieldValue(context.values, context.fieldPathPrefix)) ?? {}
}

function getChildAncestors(
  context: BuildNavigationContext,
  parentValues?: Record<string, unknown>
): readonly Record<string, unknown>[] | undefined {
  if (!parentValues) return context.ancestors
  return [parentValues, ...(context.ancestors ?? [])]
}

function getRowLabel(node: NodeRuntimeNodeDto, row: unknown, index: number) {
  if (isRecord(row) && typeof row.label === 'string' && row.label.trim()) {
    return row.label
  }

  const authoredLabel = getAuthoredRowLabel(node, row)
  if (authoredLabel) return authoredLabel

  return `${toSingularLabel(node.label)} ${index + 1}`
}

function getAuthoredRowLabel(node: NodeRuntimeNodeDto, row: unknown): string | undefined {
  if (!isRecord(row)) return undefined

  if (node.childMapId === 'effect') {
    return getOptionLabel(TRIGGER_OPTIONS, readString(getRecordValue(row, 'invocation.triggerCode')))
  }

  if (node.childMapId === 'effectPath' || node.childMapId === 'manifestBehaviorPath') {
    return getOptionLabel(PATH_CODE_OPTIONS, readString(row.pathCode))
  }

  if (node.childMapId === 'outcome' || node.childMapId === 'nonManifestOutcome') {
    return getOptionLabel(EFFECT_KIND_OPTIONS, readString(row.effectKind))
  }

  return undefined
}

function getRecordObjectValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function isNode(value: AuthoringNavigationNode | undefined): value is AuthoringNavigationNode {
  return value !== undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getOptionLabel(
  options: readonly { code: string; label: string }[],
  value: string | undefined
): string | undefined {
  if (!value) return undefined

  return options.find((option) => option.code === value)?.label
}

function getRecordValue(record: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (!isRecord(value)) return undefined
    return value[segment]
  }, record)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

function toSingularLabel(label: string) {
  if (label.endsWith('ies')) return `${label.slice(0, -3)}y`
  if (label.endsWith('ses')) return label.slice(0, -2)
  return label.endsWith('s') ? label.slice(0, -1) : label
}
