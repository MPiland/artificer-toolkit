import type {
  CharacterActionModelInput,
  CharacterActionModelOutput
} from '@artificer-toolkit/schema/api/characterActionRules'
import type {
  CharacterGrantFoldInput,
  CharacterGrantFoldOutput
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

import { dnd5eCharacterPolicyRegistration } from './systems/dnd5e/characterPolicy.js'

const installedCharacterPolicyModules = [dnd5eCharacterPolicyRegistration] as const

export function evaluateInstalledCharacterActions(input: {
  gameSystemId: string
  facts: CharacterActionModelInput
}): CharacterActionModelOutput {
  const registration = installedCharacterPolicyModules.find(
    (module) => module.gameSystemId === input.gameSystemId
  )
  if (!registration || !('evaluateCharacterActions' in registration)) {
    throw new Error(
      `No Character action policy is registered for Game System "${input.gameSystemId}".`
    )
  }
  return registration.evaluateCharacterActions(input.facts)
}

export function evaluateInstalledCharacterGrantFold(input: {
  gameSystemId: string
  facts: CharacterGrantFoldInput
}): CharacterGrantFoldOutput {
  if (input.facts.base.systemId !== input.gameSystemId) {
    throw new Error('Character grant facts and Game System identities do not match.')
  }
  const registration = installedCharacterPolicyModules.find(
    (module) => module.gameSystemId === input.gameSystemId
  )
  if (!registration || !('evaluateCharacterGrantFold' in registration)) {
    throw new Error(
      `No Character grant policy is registered for Game System "${input.gameSystemId}".`
    )
  }
  return registration.evaluateCharacterGrantFold(input.facts)
}

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
