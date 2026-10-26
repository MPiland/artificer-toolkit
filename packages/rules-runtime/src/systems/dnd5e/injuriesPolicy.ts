import type {
  ConsequenceRollTable,
  OptionalCombatPolicyInput
} from '../../optionalCombatPolicyCapability.js'
import {
  exactOptionalCombatDefinition,
  optionalCombatPolicyPin
} from './optionalCombatDefinition.js'
import { DND5E_INJURIES_POLICY_MODULE } from './policyModuleRegistration.js'

/** Lingering Injuries' authored triggers and d20 bands, when the Run has the rule on. */
export function dnd5eConsequenceRollTables(
  input: OptionalCombatPolicyInput
): readonly ConsequenceRollTable[] {
  const definition = exactOptionalCombatDefinition({
    ...input,
    kind: 'INJURIES',
    module: DND5E_INJURIES_POLICY_MODULE
  })
  const parameters = definition?.document.parameters
  if (!definition || parameters?.kind !== 'INJURIES') return []
  return [
    {
      pin: optionalCombatPolicyPin(definition),
      label: definition.label,
      triggers: parameters.triggers,
      dieFaces: 20,
      rows: parameters.bands.map((band) => ({
        rowId: band.outcome.id,
        minimum: band.minimum,
        maximum: band.maximum
      }))
    }
  ]
}
