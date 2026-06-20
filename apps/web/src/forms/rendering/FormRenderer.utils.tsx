import type { DeepKeys } from '@tanstack/form-core'
import type {
  NodeRuntimeNodeDto,
  NodeRuntimeSectionDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  requiredArray,
  requiredNumber,
  requiredSelect,
  requiredString,
  validatorsFor
} from '../validation/formValidation'
import { toTypedAuthoringFieldName } from '../utils/pathUtils'

const SYSTEM_MANAGED_FIELD_KEYS = new Set(['id', 'order', 'systemId', 'userId'])
const PROSE_FIELD_KEYS = new Set(['description', 'detail', 'quote'])
const requiredValidatorCache = new Map<string, ReturnType<typeof validatorsFor>>()

type ResettableFieldApi<TValues extends object> = {
  form?: unknown
  getFormFieldName?: <TField extends DeepKeys<TValues>>(field: TField) => string
  reset?: () => void
  resetField: <TField extends DeepKeys<TValues>>(field: TField) => void
  state: {
    fieldMeta?: Partial<Record<string, unknown>>
    isDirty?: boolean
    values: TValues
  }
}

type RootResettableFieldApi = {
  state: {
    fieldMeta?: Partial<Record<string, unknown>>
  }
  resetField: (field: string) => void
}

export function getRequiredValidators(type: NodeRuntimeNodeDto['type'], label: string) {
  const cacheKey = `${type}:${label}`
  const cached = requiredValidatorCache.get(cacheKey)
  if (cached) return cached

  const validators =
    type === 'SELECT_MULTI'
      ? validatorsFor(requiredArray(label))
      : type === 'SELECT_SINGLE'
        ? validatorsFor(requiredSelect(label))
        : type === 'NUMBER'
          ? validatorsFor(requiredNumber(label))
          : validatorsFor(requiredString(label))

  requiredValidatorCache.set(cacheKey, validators)
  return validators
}

export function resetVisibleStepFields<TValues extends object>(
  form: ResettableFieldApi<TValues>,
  sections: readonly NodeRuntimeSectionDto[],
  fieldPathPrefix?: string
) {
  const rootForm = getRootResettableFieldApi(form)
  const registeredFieldNames = Object.keys(rootForm?.state.fieldMeta ?? {})

  for (const section of sections) {
    for (const node of section.nodes) {
      if (!isResettableNode(node)) continue

      const fieldName = toTypedAuthoringFieldName<TValues>(fieldPathPrefix, node.path)
      const resolvedFieldName = getResolvedFormFieldName(form, fieldName)
      form.resetField(fieldName)

      for (const registeredFieldName of registeredFieldNames) {
        if (isDescendantFieldName(registeredFieldName, resolvedFieldName)) {
          rootForm?.resetField(registeredFieldName)
        }
      }
    }
  }
}

export function hasVisibleStepChanges<TValues extends object>(
  form: ResettableFieldApi<TValues>,
  sections: readonly NodeRuntimeSectionDto[],
  fieldPathPrefix: string | undefined,
  fieldMeta: Partial<Record<string, unknown>> | undefined
) {
  for (const section of sections) {
    for (const node of section.nodes) {
      if (!isResettableNode(node)) continue

      const fieldName = toTypedAuthoringFieldName<TValues>(fieldPathPrefix, node.path)
      const resolvedFieldName = getResolvedFormFieldName(form, fieldName)

      if (hasDirtyFieldForPath(fieldMeta, resolvedFieldName)) {
        return true
      }
    }
  }

  return false
}

function hasDirtyFieldForPath(
  fieldMeta: Partial<Record<string, unknown>> | undefined,
  fieldName: string
) {
  return Object.entries(fieldMeta ?? {}).some(
    ([registeredFieldName, meta]) =>
      (registeredFieldName === fieldName ||
        isDescendantFieldName(registeredFieldName, fieldName)) &&
      isDirtyFieldMeta(meta)
  )
}

function isDirtyFieldMeta(value: unknown): value is { isDirty: true } {
  return typeof value === 'object' && value !== null && 'isDirty' in value && value.isDirty === true
}

function getRootResettableFieldApi<TValues extends object>(
  form: ResettableFieldApi<TValues>
): RootResettableFieldApi | undefined {
  if (isRootResettableFieldApi(form.form)) return form.form
  if (isRootResettableFieldApi(form)) return form
  return undefined
}

function isRootResettableFieldApi(value: unknown): value is RootResettableFieldApi {
  return (
    typeof value === 'object' &&
    value !== null &&
    'state' in value &&
    'resetField' in value &&
    typeof value.resetField === 'function'
  )
}

function getResolvedFormFieldName<TValues extends object>(
  form: ResettableFieldApi<TValues>,
  fieldName: DeepKeys<TValues>
): string {
  return form.getFormFieldName ? form.getFormFieldName(fieldName) : String(fieldName)
}

function isDescendantFieldName(fieldName: string, parentFieldName: string) {
  return fieldName.startsWith(`${parentFieldName}.`) || fieldName.startsWith(`${parentFieldName}[`)
}

export function isRenderableNode(node: NodeRuntimeNodeDto) {
  if (!node.visible) return false
  if (isSystemManagedFieldNode(node)) return false
  return node.kind === 'INPUT'
}

function isResettableNode(node: NodeRuntimeNodeDto) {
  if (!isRenderableNode(node)) return false
  return !node.readOnly && !node.disabled
}

export function getEffectiveInputType(node: NodeRuntimeNodeDto): NodeRuntimeNodeDto['type'] {
  if (isProseFieldNode(node)) return 'RICH_TEXT'
  return node.type
}

function isProseFieldNode(node: NodeRuntimeNodeDto): boolean {
  if (node.kind !== 'INPUT') return false

  const lastPathSegment = node.path[node.path.length - 1]
  const pathKey = typeof lastPathSegment === 'string' ? lastPathSegment.toLowerCase() : ''
  const labelKey = node.label.trim().toLowerCase()

  return (
    PROSE_FIELD_KEYS.has(pathKey) ||
    pathKey.endsWith('description') ||
    pathKey.endsWith('detail') ||
    pathKey.endsWith('quote') ||
    PROSE_FIELD_KEYS.has(labelKey)
  )
}

function isSystemManagedFieldNode(node: NodeRuntimeNodeDto) {
  if (node.kind !== 'INPUT') return false

  const fieldKey = node.path[node.path.length - 1]
  return typeof fieldKey === 'string' && SYSTEM_MANAGED_FIELD_KEYS.has(fieldKey)
}

export function toEditorValues(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}
