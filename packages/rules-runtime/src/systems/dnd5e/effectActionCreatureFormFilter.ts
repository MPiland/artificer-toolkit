import type { ManifestCreatureFormFilterAuthored } from '@artificer-toolkit/shared/authored'
import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import { UUID } from './effectActionContracts.js'

type CompiledCreatureFormFilter = NonNullable<
  CharacterRuleActionActiveEffectPlan['creatureFormContribution']
>['filter']

/**
 * A creature form's authored filter as the form plan carries it (D130): `null` without one, and
 * `undefined` when it names an id that is not a UUID, a `FIXED` or `SCALED` cap without its challenge
 * rating, or a `SCALED` cap without class-level rows (rows of any other scaling source are not
 * supported, nor are rows on another cap kind).
 */
export function compiledCreatureFormFilter(
  formFilter: ManifestCreatureFormFilterAuthored | undefined
): CompiledCreatureFormFilter | undefined {
  if (!formFilter) return null
  const { creatureTypeId, challengeRatingCapKind, maxChallengeRatingId, scaling } = formFilter
  const excludedSpeedIds = formFilter.excludedSpeedIds ?? []
  const scaled = challengeRatingCapKind === 'SCALED'
  const rows =
    scaling?.scalingSource === 'CLASS_LEVEL'
      ? scaling.breakpoints.map(({ level, order, value }) => ({
          level,
          order,
          maxChallengeRatingId: value.maxChallengeRatingId,
          excludedSpeedIds: uniqueSorted(value.excludedSpeedIds ?? [])
        }))
      : []
  if (
    (creatureTypeId !== undefined && !UUID.test(creatureTypeId)) ||
    (challengeRatingCapKind !== 'TARGET') !== (maxChallengeRatingId !== undefined) ||
    (maxChallengeRatingId !== undefined && !UUID.test(maxChallengeRatingId)) ||
    excludedSpeedIds.some((speedId) => !UUID.test(speedId)) ||
    scaled !== (scaling !== undefined) ||
    (scaled &&
      (scaling?.scalingSource !== 'CLASS_LEVEL' ||
        rows.length === 0 ||
        !UUID.test(scaling.classId))) ||
    rows.some(
      (row) =>
        !UUID.test(row.maxChallengeRatingId) ||
        row.excludedSpeedIds.some((speedId) => !UUID.test(speedId))
    )
  )
    return undefined
  return {
    creatureTypeId: creatureTypeId ?? null,
    challengeRatingCapKind,
    maxChallengeRatingId: maxChallengeRatingId ?? null,
    excludedSpeedIds: uniqueSorted(excludedSpeedIds),
    scaling: scaling?.scalingSource === 'CLASS_LEVEL' ? { classId: scaling.classId, rows } : null
  }
}

const uniqueSorted = (ids: readonly string[]) => [...new Set(ids)].sort()
