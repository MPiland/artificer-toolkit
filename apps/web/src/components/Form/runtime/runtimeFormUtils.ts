import type { NodeRuntimePathDto } from '@artificer-toolkit/schema'
import { applyNodeRuntimeClearPaths } from './nodeRuntime'

export interface ClearableRuntimeForm<TValues extends object> {
  state: {
    values: TValues
  }
  setFieldValue: (field: never, value: never) => void
}

export function clearRuntimeFormPaths<TValues extends object>(
  form: ClearableRuntimeForm<TValues>,
  paths: readonly NodeRuntimePathDto[]
) {
  for (const path of applyNodeRuntimeClearPaths(toRuntimeValues(form.state.values), paths).clearedPaths) {
    form.setFieldValue(path.join('.') as never, undefined as never)
  }
}

export function toRuntimeValues(value: object): Record<string, unknown> {
  return value as Record<string, unknown>
}
