import {
  evaluateConditionIf,
  isRuntimeRecord,
  type ConditionIfExpr
} from '@artificer-toolkit/shared/utils'

export function isConditionVisible(
  condition: ConditionIfExpr | undefined,
  values: unknown
): boolean {
  return evaluateConditionIf(condition, {
    values: isRuntimeRecord(values) ? values : {}
  })
}
