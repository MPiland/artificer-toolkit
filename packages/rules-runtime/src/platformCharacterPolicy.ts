import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

import { installedCharacterSystems } from './systems/installedGameSystems/character.js'

/** One installed System's Character preparation tier (D195). */
export interface GameSystemCharacterTier {
  readonly gameSystemId: string
  readonly evaluateCharacterPolicy?: (facts: CharacterRulePolicyInput) => CharacterRulePolicyOutput
}

export function evaluateInstalledCharacterPolicy(input: {
  gameSystemId: string
  facts: CharacterRulePolicyInput
}): CharacterRulePolicyOutput {
  if (input.facts.grantFoldFacts.base.systemId !== input.gameSystemId) {
    throw new Error('Character policy facts and Game System identities do not match.')
  }
  const registration = installedCharacterSystems.find(
    (module) => module.gameSystemId === input.gameSystemId
  )
  if (!registration?.evaluateCharacterPolicy) {
    throw new Error(`No Character policy is registered for Game System "${input.gameSystemId}".`)
  }
  return registration.evaluateCharacterPolicy(input.facts)
}
