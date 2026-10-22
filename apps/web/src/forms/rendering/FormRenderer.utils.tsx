import type { DeepKeys } from '@tanstack/form-core'
import type {
  NodeRuntimeInputNodeDto,
  NodeRuntimeNodeDto,
  NodeRuntimeSectionDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  requiredArray,
  requiredBoolean,
  requiredNumber,
  requiredSelect,
  requiredString,
  validatorsFor
} from '../validation/formValidation'
import { toTypedAuthoringFieldName } from '../utils/pathUtils'
import { isRecord } from '#forms/utils/valueGuards'

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

export function getRequiredValidators(type: NodeRuntimeInputNodeDto['type'], label: string) {
  const cacheKey = `${type}:${label}`
  const cached = requiredValidatorCache.get(cacheKey)
  if (cached) return cached

  const validators =
    type === 'SELECT_MULTI'
      ? validatorsFor(requiredArray(label))
      : type === 'SELECT_SINGLE'
        ? validatorsFor(requiredSelect(label))
        : type === 'TOGGLE'
          ? validatorsFor(requiredBoolean(label))
          : type === 'NUMBER' || type === 'SELECT_NUMBER'
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
  return node.visible && node.authoring?.exposure !== 'system'
}

function isResettableNode(node: NodeRuntimeNodeDto) {
  return isRenderableNode(node)
}

export function toEditorValues(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}
