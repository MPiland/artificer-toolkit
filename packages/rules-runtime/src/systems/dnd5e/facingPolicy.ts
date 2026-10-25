import {
  exactOptionalCombatDefinition,
  optionalCombatPolicyPin
} from './optionalCombatDefinition.js'
import { DND5E_FACING_POLICY_MODULE } from './policyModuleRegistration.js'
import type { FacingRule, OptionalCombatPolicyInput } from '../../optionalCombatPolicyCapability.js'

/** The Run's exact FACING definition as a Facing rule; null when facing is off or tampered with. */
export function dnd5eFacingRule(input: OptionalCombatPolicyInput): FacingRule | null {
  const definition = exactOptionalCombatDefinition({
    ...input,
    kind: 'FACING',
    module: DND5E_FACING_POLICY_MODULE
  })
  const parameters = definition?.document.parameters
  if (!definition || parameters?.kind !== 'FACING') return null
  return {
    pin: optionalCombatPolicyPin(definition),
    facingStepDegrees: parameters.facingStepDegrees,
    arcs: parameters.arcs,
    attackerInTargetArc: parameters.attackerInTargetArc,
    sourceCannotTargetInOwnArcs: parameters.sourceCannotTargetInOwnArcs
  }
}
