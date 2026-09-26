import { resolveCharacterEffectiveMaximumHitPoints } from '@artificer-toolkit/shared/character'

import { resolveWalkingSpeedFeet } from '../walkingSpeed.js'
import type { CharacterRuleEvaluationResult } from './characterRuleEvaluation.js'

/**
 * The rules-derived values the Character row stores for display: effective maximum hit points (D7)
 * and walking speed in feet (D38). Rules keep evaluating both live.
 */
export function resolveCharacterRecordStats(
  evaluation: Pick<CharacterRuleEvaluationResult, 'facts' | 'output'>
): { maximumHitPoints: number; walkingSpeed: number } {
  return {
    maximumHitPoints: resolveCharacterEffectiveMaximumHitPoints(
      evaluation.output.derivedStats.maxHitPoints.effective
    ),
    walkingSpeed: resolveWalkingSpeedFeet(
      evaluation.output.movement.speeds,
      (evaluation.facts.movementFacts?.speeds ?? []).map((speed) => ({
        id: speed.speedId,
        code: speed.code
      }))
    )
  }
}
