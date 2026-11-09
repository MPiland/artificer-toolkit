import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'

import {
  installedCharacterPolicies,
  installedCharacterRollModes
} from './systems/installedGameSystems/character.js'

/** One installed System's Character preparation tier (D195). */
export interface GameSystemCharacterTier {
  readonly gameSystemId: string
  readonly evaluateCharacterPolicy?: (facts: CharacterRulePolicyInput) => CharacterRulePolicyOutput
  /** Resolves the policy output's roll modes and saving throw rows from its roll evidence. */
  readonly resolveCharacterRollModes?: (
    output: CharacterRulePolicyOutput,
    vocabularySnapshot?: Pick<SystemVocabularySnapshot, 'document'>
  ) => CharacterRulePolicyOutput
}

export function evaluateInstalledCharacterPolicy(input: {
  gameSystemId: string
  facts: CharacterRulePolicyInput
}): CharacterRulePolicyOutput {
  if (input.facts.grantFoldFacts.base.systemId !== input.gameSystemId) {
    throw new Error('Character policy facts and Game System identities do not match.')
  }
  const registration = installedCharacterPolicies.find(
    (module) => module.gameSystemId === input.gameSystemId
  )
  if (!registration) {
    throw new Error(`No Character policy is registered for Game System "${input.gameSystemId}".`)
  }
  return registration.evaluateCharacterPolicy(input.facts)
}

export function resolveInstalledCharacterRollModes(input: {
  gameSystemId: string
  output: CharacterRulePolicyOutput
  vocabularySnapshot?: Pick<SystemVocabularySnapshot, 'document'>
}): CharacterRulePolicyOutput {
  const registration = installedCharacterRollModes.find(
    (module) => module.gameSystemId === input.gameSystemId
  )
  if (!registration) {
    throw new Error(
      `No Character roll modes are registered for Game System "${input.gameSystemId}".`
    )
  }
  return registration.resolveCharacterRollModes(input.output, input.vocabularySnapshot)
}
