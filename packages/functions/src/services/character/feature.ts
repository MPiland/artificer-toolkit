import type { AssembledCharacterFeature } from '@artificer-toolkit/shared'

import type { CharacterAssemblyInput } from './contract.js'

/**
 * Collects all features that currently exist on the character.
 *
 * This does NOT:
 * - apply effects
 * - resolve modifiers
 * - mutate state
 */
export function assembleCharacterFeatures(
  character: CharacterAssemblyInput
): AssembledCharacterFeature[] {
  const features: AssembledCharacterFeature[] = []

  // 1. Explicit feature acquisitions (MOST IMPORTANT)
  for (const acquisition of character.intent.featureAcquisitions) {
    features.push({
      id: acquisition.id,
      featureId: acquisition.featureId,
      source: acquisition.source,
      timing: acquisition.timing,
      selections: acquisition.selections
    })
  }

  // 2. (Later) implicit features from race / class / ancestry
  // DO NOT add yet - that's the next step

  return features
}
