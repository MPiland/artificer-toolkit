import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { ENDED_EFFECT_CONDITION_OPERATION_KEY } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type { CharacterConditionRemoveOutcomeApplication } from './characterRuleActionSystemAdapter.js'
import { endedMaintenanceConditions } from './encounterActionMaintenance.js'
import { effectsEndedBy } from './encounterGrantLifetimes.js'

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
 * What an action ends on its holder: the effects that last until an attack roll or a spell cast,
 * and the conditions only they held. An action that is neither ends nothing.
 */
export function actionEndedEffects(input: {
  holderActorId: string
  held: readonly ActiveRuleEffectRecord[]
  makesAttackRoll: boolean
  castsSpell?: boolean
}) {
  const consumedGrants = effectsEndedBy(
    input.held,
    ...(input.makesAttackRoll ? (['ON_ATTACK_ROLL'] as const) : []),
    ...(input.castsSpell ? (['ON_CAST_SPELL'] as const) : [])
  )
  return {
    consumedGrants,
    sourceReleases: endedEffectConditionReleases({
      holderActorId: input.holderActorId,
      held: input.held,
      ended: consumedGrants
    })
  }
}
