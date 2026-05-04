import type {
  AssembledCharacterFeature,
  AssembledCharacterModifierGrant
} from '@artificer-toolkit/shared/core'
import type { CharacterAssemblyRegistry } from './types.js'

export function assembleCharacterModifierGrants(
  features: AssembledCharacterFeature[],
  registry: CharacterAssemblyRegistry
): AssembledCharacterModifierGrant[] {
  const out: AssembledCharacterModifierGrant[] = []

  for (const featureInstance of features) {
    const systemFeature = registry.features[featureInstance.featureId]
    if (!systemFeature?.modifiers?.length) continue

    for (const grant of systemFeature.modifiers) {
      out.push({
        // character-unique instance id
        id: `${featureInstance.id}:modifier:${grant.id}`,

        source: featureInstance.source,
        timing: featureInstance.timing,

        // the compiled grant object itself
        grant
      })
    }
  }

  return out
}
