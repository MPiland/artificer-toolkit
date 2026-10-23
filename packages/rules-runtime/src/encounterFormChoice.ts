import type { CharacterRuleActionActiveEffectPlan } from './characterRuleActionSystemAdapter.js'

type CreatureFormFilter = NonNullable<
  NonNullable<CharacterRuleActionActiveEffectPlan['creatureFormContribution']>['filter']
>

function payloadOf(snapshot: unknown): Record<string, unknown> {
  const record = typeof snapshot === 'object' && snapshot !== null ? snapshot : {}
  const payload = (record as { payload?: unknown }).payload
  return typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {}
}

/**
 * Why a Creature cannot be the form a filtered choice allows (Polymorph: a beast whose challenge
 * rating does not exceed the target's, or the target's level when it has none), or null when it can.
 * A Creature's own challenge rating is read from its snapshot, so the cast is checked against the
 * System creature corpus the form was read from.
 */
export function creatureFormFilterRefusal(input: {
  filter: CreatureFormFilter
  form: { snapshot: unknown }
  target: { snapshot: unknown; level: number | null }
  system: { challengeRatings: readonly { id: string; rank: number; value: number }[] }
}): string | null {
  const { filter, form, target, system } = input
  const formPayload = payloadOf(form.snapshot)
  if (filter.creatureTypeId !== null && formPayload.creatureTypeId !== filter.creatureTypeId)
    return 'That creature is not a type this action allows.'
  const speeds = Array.isArray(formPayload.speeds) ? formPayload.speeds : []
  if (
    speeds.some(
      (speed: unknown) =>
        typeof speed === 'object' &&
        speed !== null &&
        filter.excludedSpeedIds.includes((speed as { speedId?: string }).speedId ?? '')
    )
  )
    return 'That creature has a way of moving this action does not allow.'

  const rankOf = (id: unknown) =>
    system.challengeRatings.find((entry) => entry.id === id)?.rank ?? null
  const formRank = rankOf(formPayload.challengeRatingId)
  if (formRank === null) return 'That creature has no challenge rating.'
  const capRank =
    filter.challengeRatingCapKind === 'FIXED'
      ? rankOf(filter.maxChallengeRatingId)
      : (rankOf(payloadOf(target.snapshot).challengeRatingId) ??
        (target.level === null
          ? null
          : (system.challengeRatings.find((entry) => entry.value === target.level)?.rank ?? null)))
  if (capRank === null) return 'The target has no challenge rating or level to cap the form.'
  return formRank > capRank ? 'That creature is too powerful for this target.' : null
}
