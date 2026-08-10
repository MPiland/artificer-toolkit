import type { CharacterBuildSnapshot } from '../snapshot.js'
import type { CharacterAssemblyRegistryFeature } from '../registry.js'
import type { CharacterProvenance } from '../../subjects/authored/character/intent.js'

const FEATURE_CHOICE_SELECTION_KEY = 'options'

export function getSelectedFeatureOptions(
  feature: CharacterBuildSnapshot['features'][number],
  registryFeature: CharacterAssemblyRegistryFeature
): Array<{
  option: NonNullable<CharacterAssemblyRegistryFeature['options']>[number]
  source: CharacterProvenance
}> {
  const selectedOptionIds = getSelectedOptionIds(feature)
  if (!feature.acquisitionId || selectedOptionIds.size === 0) return []
  return (registryFeature.options ?? [])
    .filter((option) => selectedOptionIds.has(option.id))
    .map((option) => ({
      option,
      source: { kind: 'OPTION', acquiredParentId: feature.acquisitionId!, optionId: option.id }
    }))
}

export function getSelectedOptionIds(
  feature: CharacterBuildSnapshot['features'][number]
): Set<string> {
  const optionIds = new Set<string>()
  for (const selection of feature.selections ?? []) {
    if (selection.selectionKey !== FEATURE_CHOICE_SELECTION_KEY) continue
    for (const value of selection.values) {
      if (value.kind === 'ID') optionIds.add(value.id)
      if (value.kind === 'IDS') for (const id of value.ids) optionIds.add(id)
    }
  }
  return optionIds
}

export function getFeatureActiveLevel(
  snapshot: CharacterBuildSnapshot,
  feature: CharacterBuildSnapshot['features'][number]
): number {
  if (
    (feature.source.kind === 'CLASS' || feature.source.kind === 'SUBCLASS') &&
    typeof feature.source.classLevel === 'number'
  )
    return feature.source.classLevel
  if (feature.timing.kind === 'CLASS_LEVEL') return feature.timing.classLevel
  if (feature.timing.kind === 'CHARACTER_LEVEL') return feature.timing.level
  return Math.max(
    snapshot.classes.reduce((sum, classRecord) => sum + classRecord.level, 0),
    1
  )
}
