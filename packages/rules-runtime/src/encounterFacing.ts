import type { FacingRule, OptionalCombatPolicyInput } from './optionalCombatPolicyCapability.js'
import { optionalCombatPolicyCapabilityRegistry } from './platformEncounterPolicy.js'

/** The Encounter's active Facing rule (ATTACK-12); null when its System has none or facing is off. */
export function encounterFacingRule(state: OptionalCombatPolicyInput): FacingRule | null {
  return optionalCombatPolicyCapabilityRegistry.find(state.gameSystemId)?.facingRule(state) ?? null
}

/** Whether a token may face `degrees` under the Encounter's Facing rule: on, and one of its steps. */
export function admitsEncounterFacing(state: OptionalCombatPolicyInput, degrees: number): boolean {
  const rule = encounterFacingRule(state)
  return rule !== null && degrees % rule.facingStepDegrees === 0
}
