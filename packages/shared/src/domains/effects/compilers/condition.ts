import type { ConditionAuthored } from '#authored'
import { EFFECT_KIND } from '#core'
import { compileDuration, type CompiledDuration } from '#compilers'

export type CompiledConditionEffect = {
  id: string
  effectKind: typeof EFFECT_KIND.CONDITION
  conditionId: string
  recordsSource: boolean
  fleesSource: boolean
  duration?: CompiledDuration
  endsWithOutcomeId?: string
}

export function compileConditionEffect(authored: ConditionAuthored): CompiledConditionEffect[] {
  return [
    {
      id: authored.id,
      effectKind: EFFECT_KIND.CONDITION,
      conditionId: authored.conditionId,
      recordsSource: authored.recordsSource ?? false,
      fleesSource: authored.fleesSource ?? false,
      ...(authored.duration ? { duration: compileDuration(authored.duration) } : {}),
      ...(authored.endsWithOutcomeId ? { endsWithOutcomeId: authored.endsWithOutcomeId } : {})
    }
  ]
}
