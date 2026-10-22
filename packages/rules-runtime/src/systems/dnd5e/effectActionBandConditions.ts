import type {
  FailureMarginRiderAuthored,
  PathLifecycleAuthored
} from '@artificer-toolkit/shared/authored'
import type { ActiveEffectEndTrigger } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import { UUID, unsupported } from './effectActionContracts.js'
import { conditionDurationTurns, type FollowUpSaveOutcome } from './effectActionFollowUp.js'
import type { FollowUpSaveConditionOutcome } from './effectActionNestedSave.js'

type Band = Extract<FollowUpSaveOutcome['onFailure'], { kind: 'OUTCOMES' }>['outcomes']

/** The conditions a failed save's band holds, each for its own duration (D172). */
export interface TimedBandConditions {
  primary: { condition: FollowUpSaveConditionOutcome; turns: number }
  /** The band's second timed condition, as the second active effect it is held in. */
  rider: NonNullable<CharacterRuleActionActiveEffectPlan['marginRider']> | null
}

const bandConditions = (band: Band) =>
  band.filter(
    (outcome): outcome is FollowUpSaveConditionOutcome => outcome.effectKind === 'CONDITION'
  )

const timesItself = ({ duration, endsWithOutcomeId }: FollowUpSaveConditionOutcome) =>
  duration !== undefined || endsWithOutcomeId !== undefined

/**
 * The timed conditions of a failed immediate save's band: one or two conditions that each carry a
 * duration, the second optionally lasting only while the first holds (`endsWithOutcomeId`). Null
 * when the band times none. A timing anywhere else, a band half timed, a third timed condition and
 * a link to anything but a sibling condition of the band (itself, a cycle) are refused by name.
 */
export function timedBandConditions(
  save: Pick<FollowUpSaveOutcome, 'onFailure' | 'onSuccess'>
): TimedBandConditions | null {
  const success = save.onSuccess.kind === 'OUTCOMES' ? bandConditions(save.onSuccess.outcomes) : []
  const failure = save.onFailure.kind === 'OUTCOMES' ? bandConditions(save.onFailure.outcomes) : []
  const timed = failure.filter(timesItself)
  if (success.some(timesItself))
    unsupported('D&D timed conditions belong to the band of the save’s failure.')
  if (timed.length === 0) return null
  if (timed.length !== failure.length || timed.some(({ duration }) => !duration))
    unsupported('D&D a timed band gives every condition its own duration.')
  if (timed.length > 2) unsupported('D&D a timed band holds at most two conditions.')
  for (const condition of timed) {
    const { endsWithOutcomeId } = condition
    if (endsWithOutcomeId === undefined) continue
    if (endsWithOutcomeId === condition.id) unsupported('D&D a condition cannot end with itself.')
    const target = timed.find(({ id }) => id === endsWithOutcomeId)
    if (!target) unsupported('D&D a condition ends with a sibling condition of its own band.')
    if (target.endsWithOutcomeId === condition.id)
      unsupported('D&D conditions of a band cannot end with each other.')
  }
  const rider = timed.find(({ endsWithOutcomeId }) => endsWithOutcomeId !== undefined) ?? timed[1]
  const primary = timed.find((condition) => condition !== rider) ?? timed[0]
  if (!primary || !UUID.test(primary.id)) unsupported('D&D band condition identity is invalid.')
  const turnsOf = ({ duration }: FollowUpSaveConditionOutcome) => {
    const turns = duration ? conditionDurationTurns(duration) : null
    return turns ?? unsupported('D&D a band condition lasts a whole number of turns.')
  }
  return {
    primary: { condition: primary, turns: turnsOf(primary) },
    rider:
      rider && rider !== primary
        ? {
            compiledEntryId: rider.id,
            frozenGraphNodeId: 'rider-condition-duration',
            failedBy: null,
            initialRemaining: turnsOf(rider),
            linksToPrimary: rider.endsWithOutcomeId !== undefined,
            conditionContributions: [
              {
                conditionId: rider.conditionId,
                recordsSource: rider.recordsSource === true,
                fleesSource: rider.fleesSource === true
              }
            ],
            lifecycle: { endOnTriggers: [] }
          }
        : null
  }
}

/** The authored end triggers as the stored effect carries them: filters explicit, in canonical order. */
export function canonicalEndTriggers(
  triggers: NonNullable<PathLifecycleAuthored['endOnTriggers']>
): ActiveEffectEndTrigger[] {
  const compiled = triggers.map((trigger): ActiveEffectEndTrigger => {
    if (trigger.event === 'ACTION_USED_ON_HOLDER')
      return {
        event: trigger.event,
        actionDefinitionIds: [...new Set(trigger.actionDefinitionIds)].sort()
      }
    if (trigger.event !== 'DAMAGE_TAKEN') return trigger
    const { event, by, damageTypeIds } = trigger
    return {
      event,
      by,
      damageTypeIds: damageTypeIds?.length ? [...new Set(damageTypeIds)].sort() : null
    }
  })
  const keyed = new Map(compiled.map((trigger) => [JSON.stringify(trigger), trigger]))
  return [...keyed.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, t]) => t)
}

/** The second active effect a failure-margin rider holds its conditions in. */
export function marginRiderPlan(
  rider: FailureMarginRiderAuthored
): NonNullable<CharacterRuleActionActiveEffectPlan['marginRider']> {
  return {
    compiledEntryId: rider.id,
    frozenGraphNodeId: 'rider-condition-duration',
    failedBy: rider.failedBy,
    initialRemaining: null,
    linksToPrimary: false,
    conditionContributions: rider.outcomes.map((outcome) => ({
      conditionId: outcome.conditionId,
      recordsSource: outcome.recordsSource === true,
      fleesSource: outcome.fleesSource === true
    })),
    lifecycle: { endOnTriggers: canonicalEndTriggers(rider.lifecycle.endOnTriggers ?? []) }
  }
}
