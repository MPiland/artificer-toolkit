import type {
  EncounterActorRuleInput,
  EncounterActorRuleOutput
} from '@artificer-toolkit/schema/api/encounterActorRules'

import type { InitiativeFactAdapter } from './initiativeFactAdapter.js'
import { createSystemCapabilityRegistry } from './systemCapabilityRegistry.js'
import { dnd5eEncounterActorPolicyRegistration } from './systems/dnd5e/encounterActorPolicy.js'
import { dnd5eInitiativeFactAdapter } from './systems/dnd5e/initiativeFactAdapter.js'

const installedRuntimeModules = [dnd5eEncounterActorPolicyRegistration] as const

/** Encounter-only, so it is installed here rather than in the Sheet-reachable `platformPolicyModules`. */
export const initiativeCapabilityRegistry = createSystemCapabilityRegistry<InitiativeFactAdapter>(
  'initiative',
  [dnd5eInitiativeFactAdapter]
)

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
