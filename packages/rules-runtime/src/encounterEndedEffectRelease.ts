import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { CharacterConditionRemoveOutcomeApplication } from './characterRuleActionSystemAdapter.js'
import { endedMaintenanceConditions } from './encounterActionMaintenance.js'
import { effectsEndedBy } from './encounterGrantLifetimes.js'

/** Names a condition an ended effect released, in the receipt (there is no graph node to cite). */
export const ENDED_EFFECT_CONDITION_OPERATION_KEY = 'active-effect.ended'

/**
 * The conditions an event-ended effect alone held, released from its holder. A condition stays when
 * the holder had it before the effect or another effect on the holder still owns it. The holder's
 * mechanics batch applies these in the same transaction as the effects' deletion.
 */
export function endedEffectConditionReleases(input: {
  holderActorId: string
  /** Every effect the holder carries before the event. */
  held: readonly ActiveRuleEffectRecord[]
  ended: readonly ActiveRuleEffectRecord[]
}): CharacterConditionRemoveOutcomeApplication[] {
  const endedIds = new Set(input.ended.map(({ id }) => id))
  const released = endedMaintenanceConditions(
    input.ended,
    input.held.filter(({ id }) => !endedIds.has(id))
  )
  return [...released].sort().map((conditionId) => {
    const owner = input.ended.find(
      ({ definition }) =>
        definition.schemaVersion === 2 &&
        definition.stateContributions.some(
          (contribution) =>
            contribution.kind === 'CONDITION_OWNERSHIP' && contribution.conditionId === conditionId
        )
    )
    if (!owner) throw new Error('An ended effect released a condition it does not own.')
    return {
      kind: 'CONDITION_REMOVE',
      conditionId,
      sourceActiveEffectId: owner.id,
      targetActorId: input.holderActorId,
      sourceNodeId: owner.definition.frozenGraphNodeId,
      sourceOperationKey: ENDED_EFFECT_CONDITION_OPERATION_KEY,
      authoredPath: null,
      resolvedPath: null
    }
  })
}

/**
 * What an attack roll ends on its roller: the effects that last until the roll, and the conditions
 * only they held. A roll that is not an attack roll ends nothing.
 */
export function attackRollEndedEffects(input: {
  holderActorId: string
  held: readonly ActiveRuleEffectRecord[]
  makesAttackRoll: boolean
}) {
  const consumedGrants = input.makesAttackRoll ? effectsEndedBy(input.held, 'ON_ATTACK_ROLL') : []
  return {
    consumedGrants,
    sourceReleases: endedEffectConditionReleases({
      holderActorId: input.holderActorId,
      held: input.held,
      ended: consumedGrants
    })
  }
}
