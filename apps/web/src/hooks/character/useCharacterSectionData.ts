import type {
  Feature,
  SectionSourceDataType,
  CharacterSpellInput,
  CharacterSenseInput,
  CharacterModifierInput,
  CharacterExpertiseInput,
  CharacterProficiencyInput,
  CharacterFeatInput,
  FeatureProficiency,
  FeatureOption,
  FeatureExpertise,
  CharacterSectionData,
} from '~types'
import { getKeyFromId } from '~components/Form'
import { fetchBackground, fetchClass, fetchFeat, fetchRace, fetchSingleEquipment } from '~apis'
import { useQuery } from '@tanstack/react-query'
import { Attributes, ProfCats } from '~enums'
import { queryClient } from '~apis'

type SectionState = {
  __kind: CharacterSectionData['__kind']
  index: number
  optionIndex?: string | null
  optionId?: string | null
  id?: string | null
  featureLevel?: number | null
}

const sectionKindToStepMap = {
  CharacterProficiencyInput: 'proficiencies',
  CharacterExpertiseInput: 'expertise',
  CharacterModifierInput: 'modifiers',
  CharacterSenseInput: 'senses',
  CharacterFeatInput: 'feats',
  CharacterSpellInput: 'spells',
} as const

export const useCharacterSectionData = ({
  data,
}: {
  data:
    | CharacterModifierInput[]
    | CharacterExpertiseInput[]
    | CharacterProficiencyInput[]
    | CharacterSenseInput[]
    | CharacterFeatInput[]
    | CharacterSpellInput[]
}) => {
  return useQuery({
    queryKey: ['characterSectionData', data.map((item) => item.id)],
    queryFn: async (): Promise<SectionState[]> => {
      const existing: SectionState[] = []
      let index = 0
      let sIndex = 0
      const sections = data
      for (const section of sections) {
        const sectionStep = sectionKindToStepMap[section.__kind]
        let fullSections: SectionSourceDataType[] = []
        let fullFeature = {} as Feature | FeatureOption
        const featureId = section.featureId
        const classId = section.classId
        const raceId = section.raceId
        const backgroundId = section.backgroundId
        const featId = section.featId
        const ancestryId = section.ancestryId
        const equipmentId = section.equipmentId
        const optionIndex = section.optionIndex
        const optionId = section.optionId
        const featureLevel = section.featureLevel

        const existingSection: SectionState = {
          index,
          __kind: section.__kind,
        }

        if (!section.id) continue

        existingSection.id = section.id

        if (optionId) {
          existingSection.optionId = optionId
        }
        if (optionIndex) {
          existingSection.optionIndex = optionIndex
        }
        if (featureLevel) {
          existingSection.featureLevel = featureLevel
        }

        existing.push(existingSection)

        if (classId) {
          const fullClass = await queryClient.fetchQuery(fetchClass(classId))

          if (!featureId && section.__kind === 'CharacterProficiencyInput' && fullClass?.proficiencies?.length) {
            fullSections = fullClass?.proficiencies.map((proficiency) => ({
              ...proficiency,
              __typename: 'FeatureProficiency',
              masterId: undefined,
              ownerId: fullClass.ownerId,
              systemId: fullClass.systemId,
            })) as FeatureProficiency[]
          } else {
            if (featureId && fullClass?.features?.some((feature) => feature.id === featureId)) {
              const classFeature = fullClass?.features.find((feature) => feature.id === featureId)
              if (classFeature) {
                fullFeature = classFeature
              }
            }
          }
        }
        if (raceId) {
          const fullRace = await queryClient.fetchQuery(fetchRace(raceId))

          if (ancestryId) {
            const fullAncestry = fullRace?.ancestry?.options.find((option) => option.id === ancestryId)

            if (fullAncestry) {
              if (featureId && fullAncestry?.features?.some((feature) => feature.id === featureId)) {
                const ancestryFeature = fullAncestry?.features.find((feature) => feature.id === featureId)
                if (ancestryFeature) {
                  fullFeature = ancestryFeature
                }
              }
            }
          } else {
            if (featureId && fullRace?.features?.some((feature) => feature.id === featureId)) {
              const raceFeature = fullRace?.features.find((feature) => feature.id === featureId)
              if (raceFeature) {
                fullFeature = raceFeature
              }
            }
          }
        }
        if (featId) {
          const fullFeat = await queryClient.fetchQuery(fetchFeat(featId))

          if (featureId && fullFeat?.features?.some((feature) => feature.id === featureId)) {
            const featFeature = fullFeat?.features.find((feature) => feature.id === featureId)
            if (featFeature) {
              fullFeature = featFeature
            }
          }
        }
        if (backgroundId) {
          const fullBackground = await queryClient.fetchQuery(fetchBackground(backgroundId))

          if (featureId && fullBackground?.features?.some((feature) => feature.id === featureId)) {
            const backgroundFeature = fullBackground?.features.find((feature) => feature.id === featureId)
            if (backgroundFeature) {
              fullFeature = backgroundFeature
            }
          }
        }
        if (equipmentId) {
          const fullEquipment = await queryClient.fetchQuery(fetchSingleEquipment(equipmentId))

          if (featureId && fullEquipment?.features?.some((feature) => feature.id === featureId)) {
            const equipmentFeature = fullEquipment?.features.find((feature) => feature.id === featureId)
            if (equipmentFeature) {
              fullFeature = equipmentFeature
            }
          }
        }

        if (fullFeature.__typename === 'Feature' && fullFeature?.options?.length && optionId) {
          const option = fullFeature?.options.find((option) => option.id === optionId)

          if (!option) continue

          const sections = option?.[sectionStep]

          if (sections?.length) {
            fullSections = sections
          }
        }

        for (const fullSection of fullSections) {
          if (fullSection.__typename === 'FeatureProficiency' || fullSection.__typename === 'FeatureExpertise') {
            let categorySection: FeatureProficiency | FeatureExpertise | undefined | null
            if (!fullFeature[sectionStep]?.length) continue

            for (const step of fullFeature[sectionStep]) {
              if (sectionStep !== 'proficiencies' && sectionStep) {
                if (fullSection.__typename === 'FeatureProficiency' && step.id === section.id) {
                  categorySection = step as FeatureProficiency
                }
                if (section.__kind === 'CharacterExpertiseInput' && step.id === section.id) {
                  categorySection = step as FeatureExpertise
                }
              }

              const categoryId = categorySection?.category

              if (!categoryId) continue

              const categoryName = getKeyFromId(categoryId, ProfCats)

              // If the sections do not provide options, pass the set ids from the category/subcategory
              // The ones that did provides options are already set in the above in if options condition
              if (!fullSection?.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS)) {
                if (fullSection.id === section.id) {
                  if (categoryName && categoryName !== 'initiative') {
                    if (categoryName === 'equipment') {
                      const proficiencyState = fullSection[categoryName]
                      if (proficiencyState) {
                        for (const id in proficiencyState.ids) {
                          existing.push({ index: sIndex, id, __kind: section.__kind })
                        }
                      }
                    } else if (categoryName === 'properties') {
                      const proficiencyState = fullSection[categoryName]
                      if (proficiencyState) {
                        for (const property in proficiencyState.properties) {
                          existing.push({ index: sIndex, id: property, __kind: section.__kind })
                        }
                      }
                    } else {
                      // If the proficiency is skills, saveAbilities, or languages, pass the ids
                      for (const id in fullSection[categoryName]) {
                        existing.push({ index: sIndex, id: id, __kind: section.__kind })
                      }
                    }
                  }
                }
              }
            }
          } else {
            // If the sections do not provide options, pass the set ids from the category/subcategory
            // The ones that did provides options are already set in the above in if options condition
            if (!fullSection?.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS)) {
              if (section.id) {
                if (fullSection.id === section.id) {
                  existing.push({ index: sIndex, id: fullSection.id, __kind: section.__kind })
                }
              }
            }
          }
          sIndex++
        }

        index++
      }
      return existing
    },
    enabled: !!data.length,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
