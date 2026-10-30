import type {
  NodeRuntimeGroupNodeDto,
  NodeRuntimeNodeDto,
  NodeRuntimeResolveResponseDto,
  NodeRuntimeSectionDto,
  NodeRuntimeStepDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { getAuthoringFieldValue, toAuthoringFieldName } from '../utils/pathUtils'
import { getResolvedAuthoringScope } from '../authoring-schema/resolvedAuthoringScope'
import { isRecord } from '../utils/valueGuards'

export type AuthoringStepProgressStatus = 'complete' | 'incomplete' | 'warning' | 'error'
type AuthoringStepDirtyMap = Partial<Record<string, boolean>>
export type AuthoringStepWarningMap = Partial<Record<string, boolean>>
export type AuthoringStepStatusMap = Partial<Record<string, AuthoringStepProgressStatus>>

export type AuthoringProgressSummary = {
  completeCount: number
  errorCount: number
  incompleteCount: number
  stepCount: number
  warningCount: number
}

type AuthoringProgressState = {
  canFinalize: boolean
  firstBlockingStepId?: string
  firstBlockingStatus?: Exclude<AuthoringStepProgressStatus, 'complete'>
  stepDirty: AuthoringStepDirtyMap
  stepStatuses: AuthoringStepStatusMap
  summary: AuthoringProgressSummary
}

export type FieldMetaSnapshot = {
  errors?: readonly unknown[]
  isDirty?: boolean
}

export function getAuthoringProgress({
  fieldMeta,
  fieldPathPrefix,
  model,
  values,
  warnings
}: {
  fieldMeta?: Partial<Record<string, FieldMetaSnapshot>>
  fieldPathPrefix?: string
  model?: NodeRuntimeResolveResponseDto
  values: Record<string, unknown>
  warnings?: AuthoringStepWarningMap
}): AuthoringProgressState {
  const visibleSteps = model?.steps ?? []
  const stepStatuses: AuthoringStepStatusMap = {}
  const stepDirty: AuthoringStepDirtyMap = {}
  let completeCount = 0
  let incompleteCount = 0
  let warningCount = 0
  let errorCount = 0
  let firstBlockingStepId: string | undefined
  let firstBlockingStatus: Exclude<AuthoringStepProgressStatus, 'complete'> | undefined

  for (const step of visibleSteps) {
    const status = getStepStatus({
      fieldMeta,
      fieldPathPrefix,
      model,
      step,
      values,
      warning: warnings?.[step.id] === true
    })
    const dirty = isStepDirty({
      fieldMeta,
      fieldPathPrefix,
      step
    })

    stepStatuses[step.id] = status
    if (dirty) stepDirty[step.id] = true

    if (status === 'complete') completeCount += 1
    if (status === 'incomplete') incompleteCount += 1
    if (status === 'warning') warningCount += 1
    if (status === 'error') errorCount += 1

    if (status !== 'complete' && !firstBlockingStepId) {
      firstBlockingStepId = step.id
      firstBlockingStatus = status
    }
  }

  return {
    canFinalize: visibleSteps.length > 0 && completeCount === visibleSteps.length,
    firstBlockingStepId,
    firstBlockingStatus,
    stepDirty,
    stepStatuses,
    summary: {
      completeCount,
      errorCount,
      incompleteCount,
      stepCount: visibleSteps.length,
      warningCount
    }
  }
}

function getStepStatus({
  fieldMeta,
  fieldPathPrefix,
  model,
  step,
  values,
  warning
}: {
  fieldMeta?: Partial<Record<string, FieldMetaSnapshot>>
  fieldPathPrefix?: string
  model?: NodeRuntimeResolveResponseDto
  step: NodeRuntimeStepDto
  values: Record<string, unknown>
  warning: boolean
}): AuthoringStepProgressStatus {
  if (hasStepErrors({ fieldMeta, fieldPathPrefix, step })) return 'error'
  if (warning) return 'warning'
  if (hasMissingRequiredFields(step.sections, values, fieldPathPrefix, model)) return 'incomplete'
  return 'complete'
}

function hasStepErrors({
  fieldMeta,
  fieldPathPrefix,
  step
}: {
  fieldMeta?: Partial<Record<string, FieldMetaSnapshot>>
  fieldPathPrefix?: string
  step: NodeRuntimeStepDto
}) {
  return step.sections.some((section) =>
    section.nodes.some((node) => {
      if (!isUserEditableVisibleNode(node)) return false
      return hasFieldMetaForPath(
        fieldMeta,
        toAuthoringFieldName(fieldPathPrefix, node.path),
        (meta) => (meta.errors?.length ?? 0) > 0
      )
    })
  )
}

function isStepDirty({
  fieldMeta,
  fieldPathPrefix,
  step
}: {
  fieldMeta?: Partial<Record<string, FieldMetaSnapshot>>
  fieldPathPrefix?: string
  step: NodeRuntimeStepDto
}) {
  return step.sections.some((section) =>
    section.nodes.some((node) => {
      if (!isUserEditableVisibleNode(node)) return false
      return hasFieldMetaForPath(
        fieldMeta,
        toAuthoringFieldName(fieldPathPrefix, node.path),
        (meta) => meta.isDirty === true
      )
    })
  )
}

function hasMissingRequiredFields(
  sections: readonly NodeRuntimeSectionDto[],
  values: Record<string, unknown>,
  fieldPathPrefix: string | undefined,
  model: NodeRuntimeResolveResponseDto | undefined
) {
  for (const section of sections) {
    for (const node of section.nodes) {
      if (!isUserEditableVisibleNode(node)) continue

      const value = readNodeValue(values, node, fieldPathPrefix)
      if (node.required && isMissingRequiredValue(value)) return true
      if (
        node.kind === 'GROUP' &&
        hasMissingRequiredGroupFields(node, value, values, fieldPathPrefix, model)
      ) {
        return true
      }
    }
  }

  return false
}

function hasMissingRequiredGroupFields(
  node: NodeRuntimeGroupNodeDto,
  value: unknown,
  values: Record<string, unknown>,
  fieldPathPrefix: string | undefined,
  model: NodeRuntimeResolveResponseDto | undefined
) {
  if (!node.childMapId) return false

  const childMapId = node.childMapId
  const fieldName = toAuthoringFieldName(fieldPathPrefix, node.path)

  if (node.groupKind === 'OBJECT') {
    if (!isRecord(value)) return false

    const childModel = getResolvedAuthoringScope(model, childMapId, fieldName)
    if (!childModel) return false

    const childSections = childModel.steps.flatMap((step) => step.sections)
    return hasMissingRequiredFields(childSections, values, fieldName, childModel)
  }

  if (!Array.isArray(value)) return false

  return value.some((row, index) => {
    if (!isRecord(row)) return false
    const rowFieldName = `${fieldName}[${index}]`
    const childModel = getResolvedAuthoringScope(model, childMapId, rowFieldName)
    if (!childModel) return false

    const childSections = childModel.steps.flatMap((step) => step.sections)
    return hasMissingRequiredFields(childSections, values, rowFieldName, childModel)
  })
}

function readNodeValue(
  values: Record<string, unknown>,
  node: NodeRuntimeNodeDto,
  fieldPathPrefix?: string
) {
  return getAuthoringFieldValue(values, toAuthoringFieldName(fieldPathPrefix, node.path))
}

function isMissingRequiredValue(value: unknown) {
  if (value == null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (typeof value === 'number') return Number.isNaN(value)
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

function hasFieldMetaForPath(
  fieldMeta: Partial<Record<string, FieldMetaSnapshot>> | undefined,
  fieldName: string,
  predicate: (meta: FieldMetaSnapshot) => boolean
) {
  return Object.entries(fieldMeta ?? {}).some(
    ([registeredFieldName, meta]) =>
      (registeredFieldName === fieldName ||
        isDescendantFieldName(registeredFieldName, fieldName)) &&
      meta !== undefined &&
      predicate(meta)
  )
}

function isUserEditableVisibleNode(node: NodeRuntimeNodeDto) {
  return node.visible && node.authoring.exposure !== 'system'
}

function isDescendantFieldName(fieldName: string, parentFieldName: string) {
  return fieldName.startsWith(`${parentFieldName}.`) || fieldName.startsWith(`${parentFieldName}[`)
}
