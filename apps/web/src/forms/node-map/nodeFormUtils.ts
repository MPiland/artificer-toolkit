import type { NodeRuntimePathDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import type { DeepKeys, DeepValue, Updater } from '@tanstack/form-core'
import { applyResolvedNodeClearPaths } from './nodeResolution'
import { toAuthoringFieldName } from '../utils/pathUtils'

export interface ResolvedNodeClearableForm<TValues extends object> {
  state: {
    values: TValues
  }
  setFieldValue: <TField extends DeepKeys<TValues>>(
    field: TField,
    value: Updater<DeepValue<TValues, TField>>
  ) => void
}

export function clearResolvedNodeFormPaths<TValues extends object>(
  form: ResolvedNodeClearableForm<TValues>,
  paths: readonly NodeRuntimePathDto[]
) {
  for (const path of applyResolvedNodeClearPaths(toResolvedNodeValues(form.state.values), paths).clearedPaths) {
    clearResolvedNodeFormPath(form, toAuthoringFieldName(undefined, path) as DeepKeys<TValues>)
  }
}

function clearResolvedNodeFormPath<TValues extends object, TField extends DeepKeys<TValues>>(
  form: ResolvedNodeClearableForm<TValues>,
  field: TField
) {
  form.setFieldValue(field, undefined as DeepValue<TValues, TField>)
}

export function toResolvedNodeValues(value: object): Record<string, unknown> {
  return value as Record<string, unknown>
}
