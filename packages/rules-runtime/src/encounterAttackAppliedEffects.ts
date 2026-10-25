import { v5 as uuidv5 } from 'uuid'

import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'

import { effectTarget, prepareNativeIncomingDamageGrantTriggers } from './encounterActionEffects.js'
import { prepareRecurringActiveEffect } from './encounterActionEffectPlans.js'
import {
  effectsReplacedByGrants,
  type EncounterGrantTrigger
} from './encounterEndedEffectRelease.js'
import type { OptionalCombatPolicyInput } from './optionalCombatPolicyCapability.js'
import { optionalCombatPolicyCapabilityRegistry } from './platformEncounterPolicy.js'

const ATTACK_APPLIED_GRANT_NAMESPACE = '3f6b2a91-0c4e-4b7d-8e15-a9d2c6f0b347'

type GrantTriggerInput = Parameters<typeof prepareNativeIncomingDamageGrantTriggers>[0]

/**
 * The grants an attack on a holder can give it: those its own passive features give it when it takes
 * damage, and those the enabled optional rules have a qualifying attack give its target from the
 * attacker (a mark). An attack grant whose definition is `PER_SOURCE` exclusive replaces the one the
 * same attacker gave from the same Effect to any other holder. It reads only stored actors and held
 * effects, so planning and persisting prepare the same triggers.
 */
export function prepareAttackTargetGrantTriggers(
  input: Omit<GrantTriggerInput, 'holder' | 'held'> & {
    encounter: GrantTriggerInput['encounter'] & OptionalCombatPolicyInput
    attacker: EncounterRunActorState
    /** The attacked creature's rules target, with the effects it holds before the attack. */
    target: Parameters<typeof effectTarget>[0]
  }
): EncounterGrantTrigger[] {
  const { encounter, attacker, target } = input
  const holder = target.actor
  const attackApplied =
    optionalCombatPolicyCapabilityRegistry
      .find(encounter.gameSystemId)
      ?.attackAppliedEffects(encounter) ?? []
  return [
    ...prepareNativeIncomingDamageGrantTriggers({ ...input, holder, held: target.activeEffects }),
    ...attackApplied.map(({ effectId, label, meleeOnly, plan }) => {
      const effect = prepareRecurringActiveEffect({
        encounterId: encounter.id,
        occurrenceId: input.occurrenceId,
        commandId: input.commandId,
        sourceActorId: attacker.id,
        sourceLabel: label,
        sourceHidden: !attacker.public,
        currentActorId: encounter.currentActorId,
        target: effectTarget(target),
        activeEffectsByActorId: input.activeEffectsByActorId,
        activeEffectPlan: plan,
        published: plan.frozenGraph,
        d20: null
      })
      if (!effect) throw new Error('An attack-applied rule yields no effect.')
      const exclusive = effect.definition.exclusivity === 'PER_SOURCE'
      return {
        id: uuidv5(
          `${input.occurrenceId}:${input.ordinal ?? ''}:${holder.id}:${effectId}`,
          ATTACK_APPLIED_GRANT_NAMESPACE
        ),
        authoredEffectId: effectId,
        subscription: { event: 'ATTACKED' as const, meleeOnly },
        effect,
        replaces: exclusive
          ? [...input.activeEffectsByActorId]
              .filter(([actorId]) => actorId !== holder.id)
              .flatMap(([, held]) => effectsReplacedByGrants(held, [effect.definition]))
          : []
      }
    })
  ]
}
