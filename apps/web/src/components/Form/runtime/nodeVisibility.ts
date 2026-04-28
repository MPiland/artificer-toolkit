import type { ConditionIfExpr } from '@artificer-toolkit/shared'
import { get } from 'lodash-es'

export function isConditionVisible(condition: ConditionIfExpr | undefined, values: unknown): boolean {
  if (!condition) return true

  if ('and' in condition) return condition.and.every((entry) => isConditionVisible(entry, values))
  if ('or' in condition) return condition.or.some((entry) => isConditionVisible(entry, values))
  if ('not' in condition) return !isConditionVisible(condition.not, values)

  if (condition.from !== 'LOCAL') return true

  const value = get(values, condition.path.join('.'))

  switch (condition.op) {
    case '=':
      return value === condition.value
    case '>':
      return typeof value === 'number' && value > Number(condition.value)
    case '>=':
      return typeof value === 'number' && value >= Number(condition.value)
    case '<':
      return typeof value === 'number' && value < Number(condition.value)
    case '<=':
      return typeof value === 'number' && value <= Number(condition.value)
    case 'contains':
      return Array.isArray(value) && condition.value.some((entry) => value.includes(entry))
    case 'empty':
      return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
    case 'onlyValues':
      return Array.isArray(value) && value.every((entry) => condition.value.includes(entry))
    default:
      return true
  }
}
