import type {
  CompiledContentRegistry,
  AssembledCharacterModifierGrant,
  AssembledCharacterFeature
} from '@artificer-toolkit/shared'

export function assembleCharacterModifierGrants(
  features: AssembledCharacterFeature[],
  registry: CompiledContentRegistry
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
