import type { ManifestCreatureFormFilterAuthored } from '@artificer-toolkit/shared/authored'
import type { CompiledDuration } from '@artificer-toolkit/shared/compilers'
import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import { UUID } from './effectActionContracts.js'
import { amountTurns, conditionDurationTurns } from './effectActionFollowUp.js'

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

type CompiledFormDuration = {
  initialRemaining: number
  scaling: NonNullable<
    NonNullable<
      CharacterRuleActionActiveEffectPlan['creatureFormContribution']
    >['initialRemainingScaling']
  > | null
}

/**
 * How long a creature form lasts, in turns. A duration that grows with the caster's class level (Wild
 * Shape: half the druid level in hours) keeps its base turns and carries the class-level rows for the
 * cast to pick from (`resolveCreatureFormDuration`). Null for a duration the lifecycle cannot count,
 * a scaling source other than class level, or a class that is not a UUID.
 */
export function formDuration(duration: CompiledDuration): CompiledFormDuration | null {
  if (!('amount' in duration) || !duration.scaling) {
    const initialRemaining = conditionDurationTurns(duration)
    return initialRemaining === null ? null : { initialRemaining, scaling: null }
  }
  const { scaling } = duration
  const initialRemaining = amountTurns(duration.durationKind, duration.amount)
  const rows = scaling.breakpoints.map(({ level, order, value }) => ({
    level,
    order,
    turns: amountTurns(duration.durationKind, value.amount)
  }))
  if (
    scaling.scalingSource !== 'CLASS_LEVEL' ||
    !UUID.test(scaling.classId) ||
    initialRemaining === null ||
    rows.length === 0
  )
    return null
  const counted = rows.flatMap((row) => (row.turns === null ? [] : [{ ...row, turns: row.turns }]))
  return counted.length === rows.length
    ? { initialRemaining, scaling: { classId: scaling.classId, rows: counted } }
    : null
}
