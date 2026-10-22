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
  /** The band's other timed conditions, each the active effect it is held in, targets before dependents. */
  riders: NonNullable<CharacterRuleActionActiveEffectPlan['marginRiders']>[number][]
}

const bandConditions = (band: Band) =>
  band.filter(
    (outcome): outcome is FollowUpSaveConditionOutcome => outcome.effectKind === 'CONDITION'
  )

const timesItself = ({ duration, endsWithOutcomeId }: FollowUpSaveConditionOutcome) =>
  duration !== undefined || endsWithOutcomeId !== undefined

/**
 * The timed conditions of a failed immediate save's band: any conditions that each carry a
 * duration, one lasting only while another holds (`endsWithOutcomeId`); the band's other conditions
 * stay untimed. Null when the band times none. The first timed condition that ends with no other is
 * the plan's own effect and the rest are riders, ordered so each follows the one it ends with. A
 * timing anywhere else, a link without a duration and a link to anything but a timed sibling
 * condition of the band (itself, a cycle) are refused by name.
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
  // A condition the band leaves untimed applies as it always does; only a timing or a link needs a duration.
  if (timed.some(({ duration }) => !duration))
    unsupported('D&D a condition that ends with another or is timed needs its own duration.')
  for (const { id, endsWithOutcomeId } of timed) {
    if (endsWithOutcomeId === undefined) continue
    if (endsWithOutcomeId === id) unsupported('D&D a condition cannot end with itself.')
    if (!timed.some((sibling) => sibling.id === endsWithOutcomeId))
      unsupported('D&D a condition ends with a timed sibling condition of its own band.')
  }
  const primary = timed.find(({ endsWithOutcomeId }) => endsWithOutcomeId === undefined)
  if (!primary) unsupported('D&D conditions of a band cannot end with each other.')
  if (!UUID.test(primary.id)) unsupported('D&D band condition identity is invalid.')
  const turnsOf = ({ duration }: FollowUpSaveConditionOutcome) => {
    const turns = duration ? conditionDurationTurns(duration) : null
    return turns ?? unsupported('D&D a band condition lasts a whole number of turns.')
  }
  // Each pass places the conditions whose target is placed, in authored order; a pass that places
  // none leaves a cycle.
  const placed = [primary]
  for (let rest = timed.filter((c) => c !== primary); rest.length > 0;) {
    const ready = rest.filter(({ endsWithOutcomeId }) =>
      placed.some(({ id }) => id === endsWithOutcomeId || endsWithOutcomeId === undefined)
    )
    if (ready.length === 0) unsupported('D&D conditions of a band cannot end with each other.')
    placed.push(...ready)
    rest = rest.filter((condition) => !ready.includes(condition))
  }
  return {
    primary: { condition: primary, turns: turnsOf(primary) },
    riders: placed.slice(1).map((condition, index) => ({
      compiledEntryId: condition.id,
      frozenGraphNodeId: riderGraphNodeId(index),
      failedBy: null,
      initialRemaining: turnsOf(condition),
      endsWith:
        condition.endsWithOutcomeId === undefined
          ? null
          : condition.endsWithOutcomeId === primary.id
            ? 'PRIMARY'
            : placed.findIndex(({ id }) => id === condition.endsWithOutcomeId) - 1,
      conditionContributions: [
        {
          conditionId: condition.conditionId,
          recordsSource: condition.recordsSource === true,
          fleesSource: condition.fleesSource === true
        }
      ],
      lifecycle: { endOnTriggers: [] }
    }))
  }
}

/** A rider's own node of the plan's frozen graph; the first keeps the name every plan has used. */
const riderGraphNodeId = (index: number) =>
  index === 0 ? 'rider-condition-duration' : `rider-condition-duration-${index + 1}`

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

/**
 * The second active effect a failure-margin rider holds its conditions in. A rider that names the
 * condition it ends with (`endsWithOutcomeId`, D172) lasts only while that condition, the failed
 * save's one timed condition, holds; naming anything else is refused.
 */
export function marginRiderPlan(
  rider: FailureMarginRiderAuthored,
  primaryOutcomeId?: string
): NonNullable<CharacterRuleActionActiveEffectPlan['marginRiders']>[number] {
  if (rider.endsWithOutcomeId !== undefined && rider.endsWithOutcomeId !== primaryOutcomeId)
    unsupported('D&D a failure-margin rider ends with the one condition its failed save applies.')
  return {
    compiledEntryId: rider.id,
    frozenGraphNodeId: riderGraphNodeId(0),
    failedBy: rider.failedBy,
    initialRemaining: null,
    endsWith: rider.endsWithOutcomeId === undefined ? null : 'PRIMARY',
    conditionContributions: rider.outcomes.map((outcome) => ({
      conditionId: outcome.conditionId,
      recordsSource: outcome.recordsSource === true,
      fleesSource: outcome.fleesSource === true
    })),
    lifecycle: { endOnTriggers: canonicalEndTriggers(rider.lifecycle.endOnTriggers ?? []) }
  }
}
