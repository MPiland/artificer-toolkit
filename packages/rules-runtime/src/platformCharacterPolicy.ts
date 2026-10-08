import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

import { dnd5eCharacterPolicyRegistration } from './systems/dnd5e/characterPolicy.js'

const installedCharacterPolicyModules = [dnd5eCharacterPolicyRegistration] as const

export function evaluateInstalledCharacterPolicy(input: {
  gameSystemId: string
  facts: CharacterRulePolicyInput
}): CharacterRulePolicyOutput {
  if (input.facts.grantFoldFacts.base.systemId !== input.gameSystemId) {
    throw new Error('Character policy facts and Game System identities do not match.')
  }
  const registration = installedCharacterPolicyModules.find(
    (module) => module.gameSystemId === input.gameSystemId
  )
  if (!registration || !('evaluateCharacterPolicy' in registration)) {
    throw new Error(`No Character policy is registered for Game System "${input.gameSystemId}".`)
  }
  return registration.evaluateCharacterPolicy(input.facts)
}
