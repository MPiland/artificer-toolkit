import { equalCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { resolveCharacterEffectiveMaximumHitPoints } from '@artificer-toolkit/shared/character'

import { resolveSpeedsFeet } from '../walkingSpeed.js'
import type { CharacterBuilderClassSummary, CharacterBuilderSummary } from './builderTypes.js'
import type { CharacterRuleEvaluationResult } from './characterRuleEvaluation.js'

/**
 * The Sheet identity's class summary and total level, which the play record also stores so the
 * party roster reads them without a derivation (PERF-6.2).
 */
export function resolveCharacterRecordSummary(resolution: {
  summary: Pick<CharacterBuilderSummary, 'totalLevel'> & {
    classes: readonly Pick<
      CharacterBuilderClassSummary,
      'classLabel' | 'classLevel' | 'subclassLabel'
    >[]
  }
}): {
  classSummary: string
  totalLevel: number
} {
  const classSummary = resolution.summary.classes
    .map((entry) => {
      const subclass = entry.subclassLabel ? ` (${entry.subclassLabel})` : ''
      return `${entry.classLabel}${subclass} ${entry.classLevel}`
    })
    .join(' / ')
  return {
    classSummary: classSummary || 'No class selected',
    totalLevel: Math.max(resolution.summary.totalLevel, 1)
  }
}

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

/**
 * Every derived field the play record stores for one evaluated Character. Each writer that evaluates
 * the Character (Builder commit, source loss, room writes and reconciliation) stores these together.
 */
export function resolveCharacterPlayRecordStats(facts: {
  ruleEvaluation: Pick<CharacterRuleEvaluationResult, 'output' | 'registry'>
  prepared: { resolution: Parameters<typeof resolveCharacterRecordSummary>[0] }
}) {
  return {
    ...resolveCharacterRecordStats(facts.ruleEvaluation),
    ...resolveCharacterRecordSummary(facts.prepared.resolution)
  }
}

export type CharacterPlayRecordStats = ReturnType<typeof resolveCharacterPlayRecordStats>

/** Whether a play record already holds these stats, so its writer leaves it alone. */
export function equalCharacterPlayRecordStats(
  stats: CharacterPlayRecordStats,
  play: CharacterPlayRecordStats
) {
  return (
    stats.maximumHitPoints === play.maximumHitPoints &&
    equalCanonicalJson(stats.speeds, play.speeds) &&
    stats.classSummary === play.classSummary &&
    stats.totalLevel === play.totalLevel
  )
}
