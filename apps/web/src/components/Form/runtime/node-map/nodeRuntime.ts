import { clearValuesAtPaths } from '@artificer-toolkit/shared'
import type { NodeRuntimePathDto } from '@artificer-toolkit/schema'

export type NodeRuntimeChangeKind
  = | 'SELECT_SINGLE'
    | 'SELECT_MULTI'
    | 'TOGGLE'
    | 'TEXT'
    | 'NUMBER'
    | 'TEXTAREA'
    | 'RICH_TEXT'

export function getNodeRuntimeDebounceMs(kind: NodeRuntimeChangeKind | undefined): number {
  if (kind === 'SELECT_SINGLE' || kind === 'SELECT_MULTI' || kind === 'TOGGLE') return 50
  if (kind === 'TEXT' || kind === 'NUMBER' || kind === 'TEXTAREA' || kind === 'RICH_TEXT') return 200
  return 150
}

export function applyNodeRuntimeClearPaths<TValues extends Record<string, unknown>>(
  values: TValues,
  clearPaths: readonly NodeRuntimePathDto[]
) {
  return clearValuesAtPaths(values, clearPaths)
}
