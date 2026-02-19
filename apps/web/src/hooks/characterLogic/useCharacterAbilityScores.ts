import type { CharacterInput, CharacterModifierInput, FeatureModifier, ScoresInput } from '@types'
import { useQuery } from '@tanstack/react-query'
import { ScoresInputSchema } from '@artificer-toolkit/shared/schemas'
import { useOptimizedSelector } from '@store'
import { ModCats, ModMethods, ModTypes } from '@enums'
import { useCharacterBaseData } from '@hooks'

export const useCharacterAbilityScores = () => {
  // Use optimized selectors with shallow comparison
  const { abilityScores, modifiers } = useOptimizedSelector<CharacterInput, {
    abilityScores: ScoresInput[]
    modifiers: CharacterModifierInput[]
  }>((state) => ({
    abilityScores: [...(state.current?.abilities?.scores || [])],
    modifiers: state.current?.modifiers || []
  }))
  const { data: baseData, isLoading: baseDataLoading } = useCharacterBaseData()

  return useQuery({
    queryKey: ['characterAbilityScores', abilityScores.map((s) => s.ability), modifiers.map((m) => m.id)],
    queryFn: async (): Promise<ScoresInput[]> => {
      if (!baseData) return abilityScores

      // Process ability scores in parallel instead of sequential loops
      const processedScores = await Promise.all(
        abilityScores.map(async (score) => {
          let calculatedScore: number = Number(score.baseScore) || 0
          let raceScore: number = 0
          let classScore: number = 0
          let modifierScore: number = 0

          // Process modifiers for this ability score in parallel
          const modifierPromises = modifiers.map(async (cModifier) => {
            let featureMod: FeatureModifier | undefined

            // Use pre-fetched data from baseData instead of API calls
            if (cModifier.classId) {
              const foundClass = baseData.classMap.get(cModifier.classId)
              if (foundClass) {
                const feature = foundClass?.features?.find((f) => f.id === cModifier.featureId)
                const foundMod = baseData.modifierMap.get(cModifier.id)
                if (foundMod?.id && feature?.modifiers?.some((m) => m.id === foundMod.id)) {
                  featureMod = foundMod as FeatureModifier
                }
              }
            }

            if (cModifier.raceId && !featureMod) {
              const foundRace = baseData.raceMap.get(cModifier.raceId)
              if (foundRace) {
                const feature = foundRace?.features?.find((f) => f.id === cModifier.featureId)
                const foundMod = baseData.modifierMap.get(cModifier.id)
                if (foundMod?.id && feature?.modifiers?.some((m) => m.id === foundMod.id)) {
                  featureMod = foundMod as FeatureModifier
                }

                if (cModifier.ancestryId && !featureMod) {
                  const foundAncestry = baseData.ancestryMap.get(cModifier.ancestryId)
                  if (foundAncestry) {
                    const ancestryFeature = foundAncestry?.features?.find((f) => f.id === cModifier.featureId)
                    const foundMod = baseData.modifierMap.get(cModifier.id)
                    if (foundMod?.id && ancestryFeature?.modifiers?.some((m) => m.id === foundMod.id)) {
                      featureMod = foundMod as FeatureModifier
                    }
                  }
                }
              }
            }

            // Calculate modifier effects
            if (featureMod && featureMod.category === ModCats.ABILITY_SCORES) {
              const method = featureMod.method
              const type = featureMod.type

              if (type === ModTypes.BONUS && method === ModMethods.SET_GLOBALLY) {
                if (featureMod?.abilities && featureMod?.abilities?.includes(score.ability) && featureMod.setAmount) {
                  return {
                    classScore: cModifier.classId != null ? featureMod.setAmount : 0,
                    raceScore: cModifier.raceId != null ? featureMod.setAmount : 0,
                    modifierScore: featureMod.setAmount
                  }
                }
              }
            }

            return { classScore: 0, raceScore: 0, modifierScore: 0 }
          })

          // Wait for all modifier calculations for this ability score
          const modifierResults = await Promise.all(modifierPromises)

          // Sum up all modifier effects
          modifierResults.forEach((result) => {
            classScore += result.classScore
            raceScore += result.raceScore
            modifierScore += result.modifierScore
          })

          calculatedScore += raceScore + classScore

          // Only update if score changed
          if (calculatedScore !== score.calculatedScore || !score.calculatedScore) {
            return ScoresInputSchema.parse({
              ...score,
              calculatedScore,
              raceScore,
              classScore,
              modifierScore
            })
          }

          return score
        })
      )

      return processedScores
    },
    enabled: !!abilityScores && !!baseData && !baseDataLoading
  })
}
