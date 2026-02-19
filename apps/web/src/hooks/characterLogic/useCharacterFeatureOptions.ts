import type {
  CharacterInput,
  CharacterFeatureInput,
  FeatureOptionInput,
  CharacterAbilitiesInput,
  CharacterSpellcastingInput,
} from '@types'
import { getKeyFromId } from '@components/Form'
import { fetchFeature } from '@apis'
import { useQuery } from '@tanstack/react-query'
import type { DeepKeys } from '@tanstack/react-form'
import { Prerequisites } from '@enums'
import { convertTypenameToKindInput } from '@utils'
import { queryClient } from '@apis'
import type { CamelCase } from 'type-fest'

type PrerequisiteProcessor = {
  [key in CamelCase<keyof typeof Prerequisites>]?: () => boolean
}

export const useCharacterFeatureOptions = ({
  features,
  abilities,
  spellcasting,
  featureId,
  optionIndex,
}: {
  features: CharacterFeatureInput[]
  abilities: CharacterAbilitiesInput
  spellcasting: CharacterSpellcastingInput
  featureId: string
  optionIndex: string
}) => {
  return useQuery({
    queryKey: ['characterFeatureOptions', featureId, optionIndex],
    queryFn: async (): Promise<{
      options?: { id: string; label: string }[]
      path: `features${DeepKeys<NonNullable<CharacterInput['features']>>}`
      exist?: string
    }> => {
      const fullFeature = await queryClient.fetchQuery(fetchFeature(featureId))

      const featureIndex = features?.findIndex((f) => f?.id === featureId)

      const factoryFeature = features?.[featureIndex]

      const existIndex = factoryFeature?.options?.findIndex(
        (o) => o.optionIndex === optionIndex && factoryFeature?.level === o.featureLevel
      )

      const featureOptionIndex = existIndex && existIndex > -1 ? existIndex : factoryFeature?.options?.length || 0

      const exist = existIndex && existIndex > -1 ? factoryFeature?.options?.[existIndex] : null

      const path: `features${DeepKeys<NonNullable<CharacterInput['features']>>}` = `features[${featureIndex}].options[${featureOptionIndex}]`

      // Filter options based on prerequisites
      const createOptions = () => {
        if (!fullFeature?.options?.length) return []
        const filteredOptions: { id: string; label: string }[] = []
        for (const featureOption of fullFeature.options) {
          const option = convertTypenameToKindInput(featureOption) as FeatureOptionInput
          if (!option?.prerequisites || !option?.prerequisites?.options?.length) {
            filteredOptions.push({ id: option.id, label: option.label || 'Option' })
            continue
          }

          const valid = option?.prerequisites?.options?.every((prereqOption) => {
            const prereq = getKeyFromId(prereqOption, Prerequisites)

            const prerequisiteProcessors: PrerequisiteProcessor = {
              optionNotObtained: (): boolean => {
                if (!fullFeature) return true
                // Get already selected options
                const alreadySelectedOptions =
                  features
                    ?.filter((f) => f.id === fullFeature.id && f.options?.length)
                    .flatMap((f) =>
                      f.options?.filter((o) => !(o.optionIndex === optionIndex && o.id === option.id)).map((o) => o.id)
                    ) || []

                return !alreadySelectedOptions.includes(option.id)
              },

              optionsObtained: (): boolean => {
                if (!fullFeature || !option?.prerequisites?.optionsObtained?.length) return true
                return option?.prerequisites?.optionsObtained?.some((o) =>
                  features?.filter((f) => f.id === fullFeature.id).flatMap((f) => f.options?.some((fO) => fO.id === o))
                )
              },

              featuresObtained: (): boolean => {
                if (!option?.prerequisites?.featuresObtained?.length) return true
                return option?.prerequisites?.featuresObtained?.some((fO) => features?.some((f) => f.id === fO))
              },

              abilityScore: (): boolean => {
                // Get the required abilities and score
                const requiredAbilities = option?.prerequisites?.abilityScore?.abilities
                const requiredScore = option?.prerequisites?.abilityScore?.score

                if (!requiredAbilities || !requiredScore) return true

                // Check if every required ability meets the minimum score
                return requiredAbilities.every((ability): boolean => {
                  const abilityScore = abilities?.scores?.find((s) => s.ability === ability)?.calculatedScore || 0
                  return abilityScore >= requiredScore
                })
              },

              spellsObtained: (): boolean => {
                if (!option?.prerequisites?.spellsObtained?.length) return true

                // Check for the spell in all possible locations
                const inKnown =
                  spellcasting?.known?.some((s) =>
                    s.spells?.some((spell) => option?.prerequisites?.spellsObtained?.includes(spell.id))
                  ) || false

                const inPrepared =
                  spellcasting?.prepared?.some((s) =>
                    s.spells?.some((spell) => option?.prerequisites?.spellsObtained?.includes(spell.id))
                  ) || false

                const inAdditional =
                  spellcasting?.additional?.some((spell) =>
                    option?.prerequisites?.spellsObtained?.includes(spell.id)
                  ) || false

                return inKnown || inPrepared || inAdditional
              },
            }

            if (!prereq || !prerequisiteProcessors[prereq]) {
              return true
            }

            return prerequisiteProcessors[prereq]
          })

          if (valid) filteredOptions.push({ id: option.id, label: option.label || 'Option' })
        }

        return filteredOptions
      }

      const options = createOptions()

      return { path, exist: exist?.id, options }
    },
    enabled: !!featureId && !!abilities && !!spellcasting,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
