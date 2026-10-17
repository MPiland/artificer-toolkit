import type { ConditionAuthored } from '#authored'
import { EFFECT_KIND } from '#core'

export type CompiledConditionEffect = {
  id: string
  effectKind: typeof EFFECT_KIND.CONDITION
  conditionId: string
  recordsSource: boolean
  fleesSource: boolean
}

export function compileConditionEffect(authored: ConditionAuthored): CompiledConditionEffect[] {
  return [
    {
      id: authored.id,
      effectKind: EFFECT_KIND.CONDITION,
      conditionId: authored.conditionId,
      recordsSource: authored.recordsSource ?? false,
      fleesSource: authored.fleesSource ?? false
    }
  ]
}
