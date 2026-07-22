import type { CharacterBuilderGrantSummaryItemDto } from '@artificer-toolkit/schema/api/characters'

export function mergeRaceFeaturePresentation(
  features: CharacterBuilderGrantSummaryItemDto[]
): CharacterBuilderGrantSummaryItemDto[] {
  const abilityScoreFeatures = features.filter((feature) => feature.label === 'Ability Score Increase')
  if (abilityScoreFeatures.length < 2) return features

  const mergedDescriptions = [...new Set(
    abilityScoreFeatures
      .map((feature) => feature.description?.trim())
      .filter((description): description is string => Boolean(description))
  )]
  const firstAbilityScoreFeature = abilityScoreFeatures[0]

  return features.flatMap((feature) => {
    if (feature.label !== 'Ability Score Increase') return [feature]
    if (feature !== firstAbilityScoreFeature) return []

    return [{
      ...feature,
      description: mergedDescriptions.join(' ')
    }]
  })
}
