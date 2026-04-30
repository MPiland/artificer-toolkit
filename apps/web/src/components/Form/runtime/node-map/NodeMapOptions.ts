import type { NodeEntry, NodeSelectSource } from '@artificer-toolkit/shared/utils'
import { isConditionVisible } from './nodeVisibility'
import type { SelectOption } from '../utils/formUtils'

export type NodeOptionResolver<TValues extends object = object> = (args: {
  nodeId: string
  node: NodeEntry<TValues>
  source: NodeSelectSource
  values?: TValues
}) => SelectOption[]

export type DefaultSourceOptionResolverArgs<TValues extends object> = {
  source: NodeSelectSource
  values?: TValues
}

export function defaultSourceOptionResolver<TValues extends object>({
  source,
  values
}: DefaultSourceOptionResolverArgs<TValues>): SelectOption[] {
  if (source.kind === 'INLINE' && 'options' in source) {
    return source.options.map((option) => ({
      value: String(option.code),
      label: option.label
    }))
  }

  if (source.kind === 'INLINE' && 'optionGroups' in source) {
    return source.optionGroups
      .filter((group) => values === undefined || isConditionVisible(group.showIf, values))
      .flatMap((group) => group.options.map((option) => ({
        value: String(option.code),
        label: option.label
      })))
  }

  if (source.kind === 'DATA') {
    return [
      {
        value: '__runtime_options_unresolved__',
        label: 'Runtime options unavailable',
        disabled: true
      }
    ]
  }

  return []
}

export function defaultOptionResolver<TValues extends object>({
  source,
  values
}: Parameters<NodeOptionResolver<TValues>>[0]): SelectOption[] {
  return defaultSourceOptionResolver({ source, values })
}
