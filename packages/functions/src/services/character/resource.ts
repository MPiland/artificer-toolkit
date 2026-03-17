import type { AssembledCharacterResource } from '@artificer-toolkit/shared'

import type { CharacterAssemblyInput } from './contract.js'

export function assembleCharacterResources(
  character: CharacterAssemblyInput
): AssembledCharacterResource[] {
  const resources: AssembledCharacterResource[] = []

  // 1. Explicit resource grants from intent
  if (character.intent.resourceGrants) {
    for (const grant of character.intent.resourceGrants) {
      resources.push({
        id: grant.id,
        resourceId: grant.resourceId,
        source: grant.source,
        timing: grant.timing
      })
    }
  }

  // 2. (Later) implicit class / subclass resources
  // e.g. Rage, Ki, Sorcery Points
  // NOT YET

  return resources
}
