import type {
  NodeRuntimeArrayGroupNodeDto,
  NodeRuntimeNodeDto,
  NodeRuntimeObjectGroupNodeDto,
  NodeRuntimeResolveResponseDto,
  NodeRuntimeStepDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import type { AuthoredValidationIssueDto } from '@artificer-toolkit/schema/api/content'
import { getResolvedAuthoringScope } from '../authoring-schema/resolvedAuthoringScope'
import {
  areAuthoringFieldPathsRelated,
  getAuthoringFieldValue,
  toAuthoringFieldName
} from '../utils/pathUtils'
import {
  getAuthoringProgress,
  type AuthoringProgressSummary,
  type AuthoringStepProgressStatus,
  type AuthoringStepStatusMap,
  type AuthoringStepWarningMap,
  type FieldMetaSnapshot
} from '../validation/authoringProgress'
import { getVisibleAuthoringSteps } from '../hooks/useAuthoringResolvedModel'
import { getCollectionRowLabel } from '../rendering/collectionPresentation'
import {
  isResolvedArrayGroupNode,
  isResolvedGroupNode,
  isResolvedObjectGroupNode
} from '../node-map/resolvedNodeUtils'
import { isRecord } from '../utils/valueGuards'

type AuthoringNavigationTargetKind = 'drawer-item' | 'overview' | 'step'

export type AuthoringNavigationTarget = {
  ancestors?: readonly Record<string, unknown>[]
  canvasAncestors?: readonly Record<string, unknown>[]
  canvasFieldPathPrefix?: string
  canvasLabel?: string
  canvasMapId?: string
  canvasParentValues?: Record<string, unknown>
  canvasStepId?: string
  collectionFieldName?: string
  collectionNode?: NodeRuntimeArrayGroupNodeDto
  drawerRowIndex?: number
  fieldPathPrefix?: string
  id: string
  kind: AuthoringNavigationTargetKind
  label: string
  mapId: string
  ownedFieldPaths: readonly string[]
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
  validationIssues?: readonly AuthoredValidationIssueDto[]
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
  validationIssues,
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
    validationIssues,
    warnings
  }
  const navigationTree = withNavigationLevels(
    getVisibleAuthoringSteps(model)
      .map((step) => buildStepNode(step, context))
      .filter(isNode)
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

export function findAuthoringValidationTarget(
  issuePath: readonly (string | number)[],
  targets: readonly AuthoringNavigationTarget[]
) {
  const issueFieldName = toAuthoringFieldName(undefined, issuePath)
  if (!issueFieldName) return undefined

  return targets
    .flatMap((target) =>
      target.ownedFieldPaths
        .filter((ownedFieldPath) => areAuthoringFieldPathsRelated(ownedFieldPath, issueFieldName))
        .map((ownedFieldPath) => ({
          ownedFieldPath,
          score: getValidationTargetScore(ownedFieldPath, issueFieldName),
          target
        }))
    )
    .sort((left, right) => right.score - left.score)[0]?.target
}

function createNavigationTargetId({
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
  model,
  rowIndex
}: {
  collectionFieldName: string
  collectionNode: NodeRuntimeArrayGroupNodeDto
  model?: NodeRuntimeResolveResponseDto
  rowIndex: number
}) {
  const childModel = getResolvedAuthoringScope(
    model,
    collectionNode.childMapId,
    `${collectionFieldName}[${rowIndex}]`
  )
  const firstStep = getVisibleAuthoringSteps(childModel)[0]
  if (!firstStep) return undefined

  return createNavigationTargetId({
    fieldPathPrefix: `${collectionFieldName}[${rowIndex}]`,
    kind: 'step',
    mapId: collectionNode.childMapId,
    stepId: firstStep.id
  })
}

export function getArrayItemDrawerTargetId({
  collectionFieldName,
  collectionNode,
  rowIndex
}: {
  collectionFieldName: string
  collectionNode: NodeRuntimeArrayGroupNodeDto
  rowIndex: number
}) {
  return createNavigationTargetId({
    fieldPathPrefix: `${collectionFieldName}[${rowIndex}]`,
    kind: 'drawer-item',
    mapId: collectionNode.childMapId
  })
}

function buildStepNode(
  step: NodeRuntimeStepDto,
  context: BuildNavigationContext
): AuthoringNavigationNode | undefined {
  const children: AuthoringNavigationNode[] = []
  const groupNodes = step.sections.flatMap((section) =>
    section.nodes.filter(
      (node): node is NodeRuntimeObjectGroupNodeDto | NodeRuntimeArrayGroupNodeDto =>
        node.visible && isResolvedGroupNode(node)
    )
  )
  const navigableGroupNodes = groupNodes.filter((node) =>
    isNavigableAuthoringGroupNode(node, context.values, context.fieldPathPrefix)
  )
  const hasDirectContent = hasDirectEditableContent(step, context)

  if (hasDirectContent) {
    const directTarget = createStepTarget({
      context,
      label: getDirectStepLabel(step),
      step
    })

    if (navigableGroupNodes.length === 0) {
      children.push({
        id: directTarget.id,
        label: directTarget.label,
        level: 0,
        target: directTarget
      })
    }
  }

  for (const node of navigableGroupNodes) {
    const groupNode =
      node.groupKind === 'ARRAY'
        ? buildArrayCollectionNode(node, context, {
            emptyLabel:
              !hasDirectContent && navigableGroupNodes.length === 1 ? step.label : undefined,
            hideEmptyOptional: hasDirectContent && navigableGroupNodes.length > 1,
            ownerStep: step
          })
        : buildObjectGroupNode(node, context)
    if (groupNode) {
      children.push(
        !hasDirectContent && navigableGroupNodes.length === 1
          ? { ...groupNode, label: step.label }
          : groupNode
      )
    }
  }

  if (children.length === 0) return undefined
  if (children.length === 1 && (!hasDirectContent || navigableGroupNodes.length === 0)) {
    return children[0]
  }

  const directTarget = hasDirectContent
    ? createStepTarget({ context, label: getDirectStepLabel(step), step }, false)
    : undefined

  return {
    children,
    id: `container:${context.mapId}:${context.fieldPathPrefix ?? 'root'}:${step.id}`,
    label: step.label,
    level: 0,
    target: directTarget
  }
}

function buildObjectGroupNode(
  node: NodeRuntimeObjectGroupNodeDto,
  context: BuildNavigationContext
): AuthoringNavigationNode | undefined {
  const fieldPathPrefix = toAuthoringFieldName(context.fieldPathPrefix, node.path)
  const objectValues = getRecordObjectValue(getAuthoringFieldValue(context.values, fieldPathPrefix))
  if (!objectValues) return undefined

  const parentValues = getContextValues(context)
  const childAncestors = getChildAncestors(context, parentValues)
  const scopedChildModel = getResolvedAuthoringScope(
    context.model,
    node.childMapId,
    fieldPathPrefix
  )
  if (!scopedChildModel) return undefined
  const childContext: BuildNavigationContext = {
    ...context,
    ancestors: childAncestors,
    fieldPathPrefix,
    mapId: node.childMapId,
    model: scopedChildModel,
    parentValues
  }
  const children = getVisibleAuthoringSteps(scopedChildModel)
    .map((step) => buildStepNode(step, childContext))
    .filter(isNode)

  if (children.length === 0) return undefined
  const onlyChild = children[0]
  if (children.length === 1 && onlyChild?.target) {
    return {
      ...onlyChild,
      id: `object:${fieldPathPrefix}`,
      label: node.label
    }
  }

  return {
    children,
    id: `object:${fieldPathPrefix}`,
    label: node.label,
    level: 0
  }
}

function buildArrayCollectionNode(
  node: NodeRuntimeArrayGroupNodeDto,
  context: BuildNavigationContext,
  options: {
    emptyLabel?: string
    hideEmptyOptional?: boolean
    ownerStep?: NodeRuntimeStepDto
  } = {}
): AuthoringNavigationNode | undefined {
  const collectionFieldName = toAuthoringFieldName(context.fieldPathPrefix, node.path)
  const overviewTarget = createOverviewTarget({
    collectionFieldName,
    context,
    node,
    ownerStep: options.ownerStep
  })
  const rows = getArrayRows(context.values, collectionFieldName)
  if (rows.length === 0) {
    if (options.hideEmptyOptional && !node.required) return undefined
    return {
      id: overviewTarget.id,
      label: options.emptyLabel ?? node.label,
      level: 0,
      target: overviewTarget
    }
  }

  if (node.presentation === 'focused') {
    return {
      children: rows.map((row, index) => {
        const target = createDrawerItemTarget({
          collectionFieldName,
          context,
          index,
          node,
          ownerStep: options.ownerStep,
          row
        })

        return {
          id: target.id,
          label: target.label,
          level: 0,
          target
        }
      }),
      id: `collection:${collectionFieldName}`,
      label: node.label,
      level: 0,
      target: overviewTarget
    }
  }

  const children: AuthoringNavigationNode[] = []

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
    children: children.length ? children : undefined,
    id: `collection:${collectionFieldName}`,
    label: node.label,
    level: 0,
    target: overviewTarget
  }
}

function createDrawerItemTarget({
  collectionFieldName,
  context,
  index,
  node,
  ownerStep,
  row
}: {
  collectionFieldName: string
  context: BuildNavigationContext
  index: number
  node: NodeRuntimeArrayGroupNodeDto
  ownerStep?: NodeRuntimeStepDto
  row: unknown
}): AuthoringNavigationTarget {
  const fieldPathPrefix = `${collectionFieldName}[${index}]`
  const canvasLabel = getOwningCanvasLabel(ownerStep)
  const target = {
    ancestors: context.ancestors,
    canvasAncestors: context.ancestors,
    canvasFieldPathPrefix: context.fieldPathPrefix,
    canvasLabel,
    canvasMapId: context.mapId,
    canvasParentValues: context.parentValues,
    canvasStepId: ownerStep?.id,
    collectionFieldName,
    collectionNode: node,
    drawerRowIndex: index,
    fieldPathPrefix,
    id: createNavigationTargetId({
      fieldPathPrefix,
      kind: 'drawer-item',
      mapId: node.childMapId
    }),
    kind: 'drawer-item',
    label: getCollectionRowLabel(node, row, index),
    mapId: node.childMapId,
    ownedFieldPaths: [fieldPathPrefix],
    parentValues: getContextValues(context)
  } satisfies AuthoringNavigationTarget

  context.targets.push(target)
  return target
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
  node: NodeRuntimeArrayGroupNodeDto
  row: unknown
  rowPrefix: string
}) {
  const parentValues = getContextValues(context)
  const childAncestors = getChildAncestors(context, parentValues)
  const scopedChildModel = getResolvedAuthoringScope(context.model, node.childMapId, rowPrefix)
  if (!scopedChildModel) return undefined

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
    label: getCollectionRowLabel(node, row, index),
    level: 0
  } satisfies AuthoringNavigationNode
}

function createStepTarget(
  {
    context,
    label,
    step
  }: {
    context: BuildNavigationContext
    label: string
    step: NodeRuntimeStepDto
  },
  register = true
): AuthoringNavigationTarget {
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
    ownedFieldPaths: getStepOwnedFieldPaths(step, context.fieldPathPrefix),
    parentValues: context.parentValues,
    stepId: step.id
  } satisfies AuthoringNavigationTarget

  if (register) context.targets.push(target)
  return target
}

function createOverviewTarget({
  collectionFieldName,
  context,
  node,
  ownerStep
}: {
  collectionFieldName: string
  context: BuildNavigationContext
  node: NodeRuntimeArrayGroupNodeDto
  ownerStep?: NodeRuntimeStepDto
}): AuthoringNavigationTarget {
  const canvasLabel = getOwningCanvasLabel(ownerStep)
  const target = {
    canvasAncestors: context.ancestors,
    canvasFieldPathPrefix: context.fieldPathPrefix,
    canvasLabel,
    canvasMapId: context.mapId,
    canvasParentValues: context.parentValues,
    canvasStepId: ownerStep?.id,
    collectionFieldName,
    collectionNode: node,
    fieldPathPrefix: context.fieldPathPrefix,
    ancestors: context.ancestors,
    id: createNavigationTargetId({
      fieldPathPrefix: collectionFieldName,
      kind: 'overview',
      mapId: node.childMapId
    }),
    kind: 'overview',
    label: 'Overview',
    mapId: node.childMapId,
    ownedFieldPaths: [collectionFieldName],
    parentValues: context.parentValues
  } satisfies AuthoringNavigationTarget

  context.targets.push(target)
  return target
}

function getOwningCanvasLabel(ownerStep: NodeRuntimeStepDto | undefined) {
  return ownerStep?.label
}

function getTargetStatus(
  target: AuthoringNavigationTarget,
  context: BuildNavigationContext
): AuthoringStepProgressStatus {
  if (
    context.validationIssues?.some(
      (issue) => findAuthoringValidationTarget(issue.path, [target]) === target
    )
  ) {
    return 'error'
  }

  if (target.kind === 'overview') {
    const rows = target.collectionFieldName
      ? getArrayRows(context.values, target.collectionFieldName)
      : []

    return target.collectionNode?.required && rows.length === 0 ? 'incomplete' : 'complete'
  }

  if (target.kind === 'drawer-item') {
    const model = getTargetResolvedModel(target, context)
    if (!model) return 'complete'

    const progress = getAuthoringProgress({
      fieldMeta: context.fieldMeta,
      fieldPathPrefix: target.fieldPathPrefix,
      model,
      values: context.values,
      warnings: context.warnings
    })

    if (progress.summary.errorCount > 0) return 'error'
    if (progress.summary.warningCount > 0) return 'warning'
    if (progress.summary.incompleteCount > 0) return 'incomplete'
    return 'complete'
  }

  const model = getTargetStepModel(target, context)
  if (!model) return 'complete'

  return (
    getAuthoringProgress({
      fieldMeta: context.fieldMeta,
      fieldPathPrefix: target.fieldPathPrefix,
      model,
      values: context.values,
      warnings: target.stepId ? { [target.stepId]: context.warnings?.[target.stepId] } : undefined
    }).stepStatuses[target.stepId ?? ''] ?? 'complete'
  )
}

function getStepOwnedFieldPaths(step: NodeRuntimeStepDto, fieldPathPrefix?: string) {
  const ownedFieldPaths = step.sections.flatMap((section) =>
    section.nodes
      .filter((node) => node.visible && node.authoring?.exposure !== 'system')
      .map((node) => toAuthoringFieldName(fieldPathPrefix, node.path))
  )

  if (fieldPathPrefix) ownedFieldPaths.push(fieldPathPrefix)
  return [...new Set(ownedFieldPaths)]
}

function getValidationTargetScore(ownedFieldPath: string, issueFieldName: string) {
  if (ownedFieldPath === issueFieldName) return 3_000 + ownedFieldPath.length
  if (
    issueFieldName.startsWith(`${ownedFieldPath}.`) ||
    issueFieldName.startsWith(`${ownedFieldPath}[`)
  ) {
    return 2_000 + ownedFieldPath.length
  }

  return 1_000 - ownedFieldPath.length
}

function getTargetStepModel(
  target: AuthoringNavigationTarget,
  context: BuildNavigationContext
): NodeRuntimeResolveResponseDto | undefined {
  if (!target.stepId) return undefined

  const sourceModel =
    target.mapId === context.mapId && target.fieldPathPrefix === context.fieldPathPrefix
      ? context.model
      : getTargetResolvedModel(target, context)
  const step = sourceModel?.steps.find((modelStep) => modelStep.id === target.stepId)
  if (!sourceModel || !step) return undefined

  return {
    ...sourceModel,
    steps: [step]
  }
}

function getTargetResolvedModel(
  target: AuthoringNavigationTarget,
  context: BuildNavigationContext
) {
  return getResolvedAuthoringScope(context.model, target.mapId, target.fieldPathPrefix)
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
  const children = node.children?.map((child) => withAggregatedStatus(child, stepStatuses))
  const ownStatus = node.target ? stepStatuses[node.target.id] : undefined

  return {
    ...node,
    children,
    status: aggregateProgressStatus([
      ...(ownStatus ? [ownStatus] : []),
      ...(children?.map((child) => child.status) ?? [])
    ])
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

function hasDirectEditableContent(step: NodeRuntimeStepDto, context: BuildNavigationContext) {
  return step.sections.some((section) =>
    section.nodes.some((node) => {
      if (!node.visible || node.authoring?.exposure === 'system') return false
      if (node.kind !== 'GROUP') return true
      return !isNavigableAuthoringGroupNode(node, context.values, context.fieldPathPrefix)
    })
  )
}

export function isNavigableAuthoringGroupNode(
  node: NodeRuntimeNodeDto,
  rootValues: Record<string, unknown>,
  fieldPathPrefix?: string
) {
  if (!isResolvedGroupNode(node)) return false
  if (
    node.presentation === 'inline' ||
    node.presentation === 'summary' ||
    node.presentation === 'table'
  ) {
    return false
  }
  if (isResolvedObjectGroupNode(node)) {
    const fieldName = toAuthoringFieldName(fieldPathPrefix, node.path)
    if (!getRecordObjectValue(getAuthoringFieldValue(rootValues, fieldName))) return false
    return node.presentation === 'branch'
  }
  return (
    isResolvedArrayGroupNode(node) &&
    (node.presentation === 'branch' || node.presentation === 'focused')
  )
}

function getArrayRows(values: Record<string, unknown>, fieldName: string) {
  const value = getAuthoringFieldValue(values, fieldName)
  return Array.isArray(value) ? value : []
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

function getRecordObjectValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function isNode(value: AuthoringNavigationNode | undefined): value is AuthoringNavigationNode {
  return value !== undefined
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}
