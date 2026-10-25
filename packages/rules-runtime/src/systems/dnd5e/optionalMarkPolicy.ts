import { compileEffect } from '@artificer-toolkit/shared/compilers'

import type {
  AttackAppliedEffect,
  OptionalCombatPolicyInput
} from '../../optionalCombatPolicyCapability.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { unsupported } from './effectActionContracts.js'
import { durationPublishedGraph } from './effectActionLifetime.js'
import { modifierGrantEntryPlan } from './effectActionModifierGrants.js'
import { exactOptionalCombatDefinition } from './optionalCombatDefinition.js'
import { DND5E_MARK_POLICY_MODULE } from './policyModuleRegistration.js'

/**
 * The effect the enabled MARK rule has a qualifying attack give its target: the rule's authored
 * Effect, one timed grant compiled like a passive damage trigger's. None while the rule is off.
 */
export function dnd5eAttackAppliedEffects(
  input: OptionalCombatPolicyInput
): readonly AttackAppliedEffect[] {
  const definition = exactOptionalCombatDefinition({
    ...input,
    kind: 'MARK',
    module: DND5E_MARK_POLICY_MODULE
  })
  if (definition?.document.parameters.kind !== 'MARK') return []
  const { effect, qualifyingAttackKind } = definition.document.parameters
  const compiledEffect = compileEffect(effect)
  const [entry] = compiledEffect.entries
  if (compiledEffect.entries.length !== 1 || !entry)
    unsupported('D&D attack-applied effect must author one result.')
  const plan = modifierGrantEntryPlan({
    action: {
      gameSystemId: DND5E_SYSTEM_ID,
      entryPointDefinitionId: effect.id,
      effectId: effect.id,
      compiledEffect
    },
    entry,
    resultGated: false,
    untilEndEvent: false
  })
  if (!plan?.modifierGrantContribution)
    unsupported('D&D attack-applied effect must give a timed modifier grant.')
  return [
    {
      effectId: effect.id,
      label: definition.label,
      meleeOnly: qualifyingAttackKind === 'MELEE',
      plan: { ...plan, frozenGraph: durationPublishedGraph({ effectId: effect.id, plan }) }
    }
  ]
}
