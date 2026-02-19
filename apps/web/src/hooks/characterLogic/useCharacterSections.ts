import type {
  CharacterInput,
  CharacterFeatureInput,
  FeatureOptionInput,
  Feature,
  CharacterSenseInput,
  CharacterModifierInput,
  CharacterExpertiseInput,
  CharacterProficiencyInput,
  CharacterFeatInput,
  FeatureOption,
  SectionFormDataType
} from '@types'
import { getKeyFromId, SECTION_STEPS } from '@components/Form'
import { fetchFeature, fetchFeatureOption } from '@apis'
import { useQuery } from '@tanstack/react-query'
import {
  CharacterExpertiseInputSchema,
  CharacterFeatInputSchema,
  CharacterModifierInputSchema,
  CharacterProficiencyInputSchema,
  CharacterSenseInputSchema,
  FeatureExpertiseInputSchema,
  FeatureFeatInputSchema,
  FeatureModifierInputSchema,
  FeatureProficiencyInputSchema,
  FeatureSenseInputSchema,
  FeatureSpellInputSchema
} from '@artificer-toolkit/shared/schemas'
import { useOptimizedSelector } from '@store'
import { Attributes, ProfCats } from '@enums'
import { kind, proficiencyKey, sectionIdKey } from '@utils'
import { z } from 'zod/v4'
import { queryClient } from '@apis'
import { useCharacterFeatures, useCharacterBaseData, useCharacterSectionData } from '@hooks'

export const sectionTypeMap: Record<
  (typeof SECTION_STEPS)[number],
  z.ZodType<SectionFormDataType> | z.ZodType<FeatureOptionInput>
> = {
  proficiencies: FeatureProficiencyInputSchema,
  expertise: FeatureExpertiseInputSchema,
  modifiers: FeatureModifierInputSchema,
  senses: FeatureSenseInputSchema,
  spells: FeatureSpellInputSchema,
  feats: FeatureFeatInputSchema
}

export const useCharacterSections = () => {
  // Use optimized selector to get only the specific properties we need
  const {
    characterId,
    characterClasses,
    characterFeats,
    characterModifiers,
    characterProficiencies,
    characterExpertise,
    characterSenses
  } = useOptimizedSelector<
    CharacterInput,
    {
      characterId: string | undefined
      characterClasses: CharacterInput['classes']
      characterFeats: CharacterInput['feats']
      characterModifiers: CharacterInput['modifiers']
      characterProficiencies: CharacterInput['proficiencies']
      characterExpertise: CharacterInput['expertise']
      characterSenses: CharacterInput['senses']
    }
  >((state) => ({
    characterId: state.current?.id,
    characterClasses: state.current?.classes,
    characterFeats: state.current?.feats,
    characterModifiers: state.current?.modifiers,
    characterProficiencies: state.current?.proficiencies,
    characterExpertise: state.current?.expertise,
    characterSenses: state.current?.senses
  }))

  const features = useCharacterFeatures()
  const { data: baseData, isLoading: baseDataLoading } = useCharacterBaseData()

  // Call section data hooks at the top level
  const featsData = useCharacterSectionData({ data: characterFeats || [] })
  const modifiersData = useCharacterSectionData({ data: characterModifiers || [] })
  const proficienciesData = useCharacterSectionData({ data: characterProficiencies || [] })
  const expertiseData = useCharacterSectionData({ data: characterExpertise || [] })
  const sensesData = useCharacterSectionData({ data: characterSenses || [] })

  const { data: sections } = useQuery({
    queryKey: [
      'characterSections',
      characterId,
      features?.data?.map((f) => f?.id).filter(Boolean),
      featsData.data?.map((f) => f.id),
      modifiersData.data?.map((m) => m.id),
      proficienciesData.data?.map((p) => p.id),
      expertiseData.data?.map((e) => e.id),
      sensesData.data?.map((s) => s.id),
      // Add baseData to dependencies
      baseData ? 'baseData-loaded' : 'baseData-loading'
    ],
    queryFn: async () => {
      // Create sections object with explicit typing
      const sections = {
        feats: (featsData.data as CharacterFeatInput[]) || [],
        modifiers: (modifiersData.data as CharacterModifierInput[]) || [],
        proficiencies: (proficienciesData.data as CharacterProficiencyInput[]) || [],
        expertise: (expertiseData.data as CharacterExpertiseInput[]) || [],
        senses: (sensesData.data as CharacterSenseInput[]) || []
      }

      // Note: categoryIdentifiersCache removed since we optimized duplicate detection with Set lookups

      // Create lookup sets for faster duplicate detection (O(1) instead of O(n))
      const sectionLookups = {
        feats: new Set(sections.feats.map((s) => `${s.featureId}-${s.id}`)),
        modifiers: new Set(sections.modifiers.map((s) => `${s.featureId}-${s.id}`)),
        proficiencies: new Set(sections.proficiencies.map((s) => `${s.featureId}-${s.id}`)),
        expertise: new Set(sections.expertise.map((s) => `${s.featureId}-${s.id}`)),
        senses: new Set(sections.senses.map((s) => `${s.featureId}-${s.id}`))
      }

      // Specific type guard that preserves the object type
      function hasProperty<T extends object, K extends string>(obj: T, key: K): obj is T & Record<K, unknown> {
        return key in obj
      }

      // Type-safe function to get a property from an object
      function getProperty<T extends object, K extends string>(obj: T, key: K): unknown {
        if (hasProperty(obj, key)) {
          return obj[key]
        }
        return undefined
      }

      // Type-safe function to add a section
      function pushToSection<K extends keyof typeof sections>(
        step: K,
        obj:
          | CharacterModifierInput
          | CharacterExpertiseInput
          | CharacterProficiencyInput
          | CharacterSenseInput
          | CharacterFeatInput
      ): void {
        const idKey = sectionIdKey(step)

        // Type guard using the existing sections object type
        function isSectionType<T extends keyof typeof sections>(
          obj:
            | CharacterModifierInput
            | CharacterExpertiseInput
            | CharacterProficiencyInput
            | CharacterSenseInput
            | CharacterFeatInput,
          section: T
        ): obj is (typeof sections)[T][number] {
          return obj.__kind === kind(section, '__kind')
        }

        // Fast O(1) lookup for basic duplicates
        const objWithFeatureId = obj as { featureId?: string }
        const lookupKey = `${objWithFeatureId.featureId}-${getProperty(obj, idKey)}`
        const exists = sectionLookups[step].has(lookupKey)

        if (!exists) {
          if (isSectionType(obj, step)) {
            // Get a reference to the array with the correct type
            const sectionArray = sections[step] as Array<(typeof sections)[typeof step][number]>
            // Push to it (this modifies the original array)
            sectionArray.push(obj as (typeof sections)[typeof step][number])
            // Update the lookup set for future checks
            sectionLookups[step].add(lookupKey)
          } else {
            console.warn(`Attempted to add object with wrong type to ${step} section`)
          }
        }
      }

      // Process features...
      const pushSections = (fullFeature: Feature | FeatureOption) => {
        // Create lightweight feature object without expensive schema parsing
        const featureObject = {
          __kind: 'CharacterFeatureInput' as const,
          id: fullFeature.id
        }
        SECTION_STEPS.filter((step) => step !== 'spells').forEach((sectionStep) => {
          if (fullFeature?.[sectionStep]?.length) {
            fullFeature[sectionStep].forEach((section) => {
              const sectionInput = sectionTypeMap[sectionStep].parse(section)
              if (!sectionInput?.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS)) {
                // Special handling for proficiencies and expertise
                if (
                  (sectionInput?.__kind === 'FeatureProficiencyInput'
                    || sectionInput?.__kind === 'FeatureExpertiseInput')
                  && sectionInput.category
                ) {
                  const categoryId = sectionInput.category
                  const categoryName = getKeyFromId(categoryId, ProfCats)

                  // Handle different category types that contain arrays
                  if (categoryName && categoryName !== 'initiative') {
                    if (categoryName === 'equipment' && sectionInput.equipment?.ids) {
                      // Handle equipment IDs array
                      sectionInput.equipment.ids.forEach((equipId) => {
                        if (equipId !== 'all') {
                          const sectionObject = createBaseSectionObject(
                            sectionStep as 'proficiencies' | 'expertise',
                            sectionInput,
                            fullFeature,
                            featureObject
                          )
                          sectionObject.equipment = equipId
                          pushToSection(sectionStep, sectionObject)
                        }
                      })
                    } else if (categoryName === 'properties' && sectionInput.properties?.properties) {
                      // Handle properties array
                      sectionInput.properties.properties.forEach((propId) => {
                        if (propId !== 'all') {
                          const sectionObject = createBaseSectionObject(
                            sectionStep as 'proficiencies' | 'expertise',
                            sectionInput,
                            fullFeature,
                            featureObject
                          )
                          sectionObject.property = propId
                          pushToSection(sectionStep, sectionObject)
                        }
                      })
                    } else if (sectionInput[categoryName] && Array.isArray(sectionInput[categoryName])) {
                      // Handle other arrays like skills, saveAbilities, languages
                      sectionInput[categoryName].forEach((itemId) => {
                        if (itemId !== 'all') {
                          const sectionObject = createBaseSectionObject(
                            sectionStep as 'proficiencies' | 'expertise',
                            sectionInput,
                            fullFeature,
                            featureObject
                          )

                          // Use the typename function to get the correct ID field
                          const categoryField = proficiencyKey(categoryName)
                          if (categoryField) {
                            sectionObject[categoryField] = itemId
                            pushToSection(sectionStep, sectionObject)
                          }
                        }
                      })
                    } else {
                      // Handle non-array case
                      const sectionObject = createBaseSectionObject(
                        sectionStep,
                        sectionInput,
                        fullFeature,
                        featureObject
                      )
                      pushToSection(sectionStep, sectionObject)
                    }
                  } else {
                    // Handle initiative or unknown category
                    const sectionObject = createBaseSectionObject(sectionStep, sectionInput, fullFeature, featureObject)
                    pushToSection(sectionStep, sectionObject)
                  }
                } else {
                  // Normal case for non-proficiency/expertise sections
                  const sectionObject = createBaseSectionObject(
                    sectionStep,
                    sectionInput as SectionFormDataType,
                    fullFeature,
                    featureObject
                  )
                  pushToSection(sectionStep, sectionObject)
                }
              }
            })
          }
        })
      }

      // Helper function to create the base section object
      function createBaseSectionObject<T extends keyof typeof sections>(
        sectionStep: T,
        fSection: SectionFormDataType,
        fullFeature: Feature | FeatureOption,
        feature: CharacterFeatureInput
      ): (typeof sections)[T][number] {
        // Use the specific return type based on the section type
        const typeName = kind(sectionStep, '__kind')

        const characterSectionSchemas = z.discriminatedUnion('__kind', [
          CharacterProficiencyInputSchema,
          CharacterExpertiseInputSchema,
          CharacterModifierInputSchema,
          CharacterSenseInputSchema,
          CharacterFeatInputSchema
        ])

        // Create the base object with the required type
        const sectionObject = characterSectionSchemas.parse({
          __kind: typeName,
          id: fSection.id,
          featureId: fullFeature.id
        })

        const sectionIds = [
          'classId', 'raceId', 'backgroundId', 'equipmentId', 'ancestryId', 'featId'
        ] as const

        // Add source IDs
        sectionIds.forEach((sourceKey) => {
          if (feature?.[sourceKey]) {
            sectionObject[sourceKey] = feature[sourceKey]
          }
        })

        return sectionObject as (typeof sections)[typeof sectionStep][number]
      }

      // Use pre-fetched data from baseData instead of making API calls
      if (!baseData || baseDataLoading) {
        return {
          feats: [],
          modifiers: [],
          proficiencies: [],
          expertise: [],
          senses: []
        }
      }

      // Batch feature and feature option API calls (still needed for section processing)
      const featurePromises = features?.data?.map((feature) => queryClient.fetchQuery(fetchFeature(feature.id))) || []
      const featureOptionPromises
        = features?.data
          ?.filter((feature) => feature?.options?.length)
          .flatMap((feature) => feature.options!.map((option) => queryClient.fetchQuery(fetchFeatureOption(option.id)))) || []

      // Execute feature API calls in parallel
      const [fullFeatures, featureOptionsData] = await Promise.all([
        Promise.all(featurePromises),
        Promise.all(featureOptionPromises)
      ])

      // Process features
      fullFeatures.forEach((fullFeature) => {
        if (fullFeature) {
          pushSections(fullFeature)
        }
      })

      // Process options with proper feature context
      featureOptionsData.forEach((fullOption) => {
        if (fullOption) {
          pushSections(fullOption)
        }
      })

      // Process class proficiencies using pre-fetched classes from baseData
      characterClasses?.forEach((fClass) => {
        const fullClass = baseData.classMap.get(fClass.id)
        if (!fullClass) return

        const proficiencies = fullClass?.proficiencies || []

        proficiencies?.forEach((proficiency) => {
          const exist = sections.proficiencies.find((s) => s.classId === fClass.id && s.id === proficiency.id)
          if (exist) return

          const sectionObject = CharacterProficiencyInputSchema.parse({
            __kind: 'CharacterProficiencyInput',
            classId: fClass.id,
            id: proficiency.id,
            featureId: fullClass.id
          })
          pushToSection('proficiencies', sectionObject)
        })
      })

      return sections
    },
    enabled:
      !!characterId
      && !!features
      && !!baseData
      && !baseDataLoading
      && !featsData.isLoading
      && !modifiersData.isLoading
      && !proficienciesData.isLoading
      && !expertiseData.isLoading
      && !sensesData.isLoading,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
  return sections
}
