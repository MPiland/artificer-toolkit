import type {
  EncounterActorRuleInput,
  EncounterActorRuleOutput
} from '@artificer-toolkit/schema/api/encounterActorRules'

import { dnd5eEncounterActorPolicyRegistration } from './systems/dnd5e/encounterActorPolicy.js'

const installedRuntimeModules = [dnd5eEncounterActorPolicyRegistration] as const

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
