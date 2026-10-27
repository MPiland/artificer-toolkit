import { v5 as uuidv5 } from 'uuid'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'

import { prepareActiveRuleEffectRecord } from './activeRuleEffectRecords.js'
import { effectTarget } from './encounterActionEffects.js'
import { prepareRecurringActiveEffect } from './encounterActionEffectPlans.js'
import { TOUCH_RANGE } from './encounterActionTargetPolicy.js'
import { turnEffectOwner } from './encounterTurnEffectState.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { OptionalCombatPolicyInput } from './optionalCombatPolicyCapability.js'
import { optionalCombatPolicyCapabilityRegistry } from './platformEncounterPolicy.js'

const PASSAGE_APPLIED_EFFECT_NAMESPACE = '5b0e6c3a-7d24-4f8e-9a61-c4d3e2f1a082'

/**
 * The effects the rule behind a won passage contest gives the creature it contested, sourced by the
 * mover (the cling a climb leaves): the rule's authored Effect planned like a contest hold's and
 * recorded on the contested creature. A relationship the mover already holds on its limit
 * (`heldAtOnce`) yields none. The ids derive from the occurrence, so planning and replay agree.
 */
export function preparePassageAppliedEffects(input: {
  state: EncounterRunState & OptionalCombatPolicyInput
  definitionId: string
  occurrenceId: string
  commandId: string
  occurredAt: string
  source: MovementTarget
  target: MovementTarget
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
}): ActiveRuleEffectRecord[] {
  const { state, source, target } = input
  const applied =
    optionalCombatPolicyCapabilityRegistry.find(state.gameSystemId)?.passageAppliedEffects(state) ??
    []
  const currentEffects = [...target.activeEffects]
  return applied
    .filter(({ definitionId }) => definitionId === input.definitionId)
    .flatMap(({ effectId, label, plan }) => {
      const effect = prepareRecurringActiveEffect({
        encounterId: state.id,
        occurrenceId: input.occurrenceId,
        commandId: input.commandId,
        sourceActorId: source.actor.id,
        sourceLabel: label,
        sourceHidden: !source.actor.public,
        currentActorId: state.currentActorId,
        target: effectTarget(target),
        activeEffectsByActorId: input.activeEffectsByActorId,
        activeEffectPlan: plan,
        sealedReachFeet: TOUCH_RANGE.amount,
        published: plan.frozenGraph,
        d20: null
      })
      if (!effect) return []
      const record = prepareActiveRuleEffectRecord({
        id: uuidv5(
          `${input.occurrenceId}:${target.actor.id}:${effectId}`,
          PASSAGE_APPLIED_EFFECT_NAMESPACE
        ),
        owner: turnEffectOwner(target.actor, state.id),
        definition: effect.definition,
        lifecycle: effect.lifecycle,
        currentEffects,
        occurredAt: input.occurredAt
      })
      currentEffects.push(record)
      return [record]
    })
}
