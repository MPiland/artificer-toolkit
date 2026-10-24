import type { ManifestCreatureFormFilterAuthored } from '@artificer-toolkit/shared/authored'
import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import { UUID } from './effectActionContracts.js'

type CompiledCreatureFormFilter = NonNullable<
  CharacterRuleActionActiveEffectPlan['creatureFormContribution']
>['filter']

/**
 * A creature form's authored filter as the form plan carries it (D130): `null` without one, and
 * `undefined` when it names an id that is not a UUID or a `FIXED` cap without its challenge rating.
 */
export function compiledCreatureFormFilter(
  formFilter: ManifestCreatureFormFilterAuthored | undefined
): CompiledCreatureFormFilter | undefined {
  if (!formFilter) return null
  const { creatureTypeId, challengeRatingCapKind, maxChallengeRatingId } = formFilter
  const excludedSpeedIds = formFilter.excludedSpeedIds ?? []
  if (
    (creatureTypeId !== undefined && !UUID.test(creatureTypeId)) ||
    (challengeRatingCapKind === 'FIXED') !== (maxChallengeRatingId !== undefined) ||
    (maxChallengeRatingId !== undefined && !UUID.test(maxChallengeRatingId)) ||
    excludedSpeedIds.some((speedId) => !UUID.test(speedId))
  )
    return undefined
  return {
    creatureTypeId: creatureTypeId ?? null,
    challengeRatingCapKind,
    maxChallengeRatingId: maxChallengeRatingId ?? null,
    excludedSpeedIds: [...new Set(excludedSpeedIds)].sort()
  }
}
