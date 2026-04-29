import type { NodeRuntimePathDto } from '@artificer-toolkit/schema'
import type { DeepKeys, DeepValue, Updater } from '@tanstack/form-core'
import { applyNodeRuntimeClearPaths } from './nodeRuntime'

export interface ClearableRuntimeForm<TValues extends object> {
  state: {
    values: TValues
  }
  setFieldValue: <TField extends DeepKeys<TValues>>(
    field: TField,
    value: Updater<DeepValue<TValues, TField>>
  ) => void
}

export function clearRuntimeFormPaths<TValues extends object>(
  form: ClearableRuntimeForm<TValues>,
  paths: readonly NodeRuntimePathDto[]
) {
  for (const path of applyNodeRuntimeClearPaths(toRuntimeValues(form.state.values), paths).clearedPaths) {
    clearRuntimeFormPath(form, path.join('.') as DeepKeys<TValues>)
  }
}

function clearRuntimeFormPath<TValues extends object, TField extends DeepKeys<TValues>>(
  form: ClearableRuntimeForm<TValues>,
  field: TField
) {
  form.setFieldValue(field, undefined as DeepValue<TValues, TField>)
}

export function toRuntimeValues(value: object): Record<string, unknown> {
  return value as Record<string, unknown>
}
