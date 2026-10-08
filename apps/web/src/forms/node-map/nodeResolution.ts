import { clearValuesAtPaths } from '@artificer-toolkit/shared/utils'
import type { NodeRuntimePathDto } from '@artificer-toolkit/schema/api/nodeRuntime'

export function applyResolvedNodeClearPaths<TValues extends Record<string, unknown>>(
  values: TValues,
  clearPaths: readonly NodeRuntimePathDto[]
) {
  return clearValuesAtPaths(values, clearPaths)
}
