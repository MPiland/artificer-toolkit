import { resolveCharacterEffectiveMaximumHitPoints } from '@artificer-toolkit/shared/character'

import { resolveSpeedsFeet } from '../walkingSpeed.js'
import type { CharacterRuleEvaluationResult } from './characterRuleEvaluation.js'

/**
 * The rules-derived values the Character row stores for display: effective maximum hit points (D7),
 * before active-effect reductions, and every typed speed in feet (D38, SPELLS-5.6). Rules keep
 * evaluating both live.
 */
export function resolveCharacterRecordStats(
  evaluation: Pick<CharacterRuleEvaluationResult, 'output' | 'registry'>
): {
  maximumHitPoints: number
  speeds: { speedId: string; amount: number; unit: 'FEET' }[]
} {
  return {
    maximumHitPoints: resolveCharacterEffectiveMaximumHitPoints(
      evaluation.output.derivedStats.maxHitPoints.effective
    ),
    speeds: resolveSpeedsFeet(
      evaluation.output.movement.speeds,
      evaluation.registry.system?.speeds ?? []
    ).map(({ speedId, feet }) => ({ speedId, amount: feet, unit: 'FEET' as const }))
  }
}
