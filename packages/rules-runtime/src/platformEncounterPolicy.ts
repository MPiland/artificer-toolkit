import type {
  EncounterActorRuleInput,
  EncounterActorRuleOutput
} from '@artificer-toolkit/schema/api/encounterActorRules'

import type { ArmorClassCapabilityAdapter } from './armorClassCapability.js'
import type { D20TestDefinitionCapabilityAdapter } from './d20TestDefinitionCapability.js'
import type { InitiativeFactAdapter } from './initiativeFactAdapter.js'
import { createSystemCapabilityRegistry } from './systemCapabilityRegistry.js'
import { dnd5eArmorClassCapabilityAdapter } from './systems/dnd5e/characterVitals.js'
import { dnd5eEncounterActorPolicyRegistration } from './systems/dnd5e/encounterActorPolicy.js'
import { dnd5eD20TestDefinitionCapabilityAdapter } from './systems/dnd5e/encounterLifecyclePolicy.js'
import { dnd5eInitiativeFactAdapter } from './systems/dnd5e/initiativeFactAdapter.js'

const installedRuntimeModules = [dnd5eEncounterActorPolicyRegistration] as const

// Encounter-only capabilities, so they are installed here rather than in the Sheet-reachable
// `platformPolicyModules`.
export const initiativeCapabilityRegistry = createSystemCapabilityRegistry<InitiativeFactAdapter>(
  'initiative',
  [dnd5eInitiativeFactAdapter]
)

export const armorClassCapabilityRegistry =
  createSystemCapabilityRegistry<ArmorClassCapabilityAdapter>('armor-class', [
    dnd5eArmorClassCapabilityAdapter
  ])

export const d20TestDefinitionCapabilityRegistry =
  createSystemCapabilityRegistry<D20TestDefinitionCapabilityAdapter>('d20-test-definition', [
    dnd5eD20TestDefinitionCapabilityAdapter
  ])

/** System-owned semantic preparation; generic Encounter application owns reconciliation. */
export function evaluateInstalledEncounterActors(input: {
  gameSystemId: string
  facts: EncounterActorRuleInput
}): EncounterActorRuleOutput {
  const registration = installedRuntimeModules.find(
    (module) => module.gameSystemId === input.gameSystemId
  )
  if (!registration || !('evaluateEncounterActors' in registration)) {
    throw new Error(
      `No Encounter actor policy is registered for Game System "${input.gameSystemId}".`
    )
  }
  return registration.evaluateEncounterActors(input.facts)
}
