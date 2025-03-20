import {
  AncestryFeature,
  AncestryOption,
  Character,
  CharacterExpertise,
  CharacterFeat,
  CharacterFeature,
  CharacterModifier,
  CharacterProficiency,
  CharacterSense,
  Class,
  Feature,
  FeatureExpertise,
  FeatureFeat,
  FeatureModifier,
  FeatureOption,
  FeatureProficiency,
  FeatureSense,
  FeatureSpell,
  Race,
  Scores,
  Spell,
} from '../../amplify/gql/types'
import { CharacterSectionData, DeepKeyOf, SectionDataType, SectionName } from '../types/form'
import {
  Attributes,
  ModifierCategories,
  ModifierSpellCategories,
  ProficiencyCategories,
  ModifierTypes,
  ModifierMethods,
} from '../types/enums'
import { useListClassesQuery } from '../features/classes/classesApi'
import { useListEquipmentQuery } from '../features/equipment/equipmentApi'
import { useListSpellsQuery } from '../features/spells/spellsApi'
import { useGetSystemQuery } from '../features/systems/systemsApi'
import { getKeyFromId, getModifierProperties } from '../utils/form'
import { useListRacesQuery } from '../features/races/racesApi'
import { useListFeatsQuery } from '../features/feats/featsApi'
import { useListBackgroundsQuery } from '../features/backgrounds/backgroundsApi'
import { sectionSteps } from '../types/form'
import { useCallback, useMemo } from 'react'
import { typename, sectionIdKey, proficiencyKey } from '../utils/formatting'
import useGetFeatures, { FactoryFeature } from './useGetFeatures'

export interface GetSectionOptionsProps {
  section: SectionDataType
  sectionStep: Exclude<SectionName, 'ancestries' | 'options' | 'subfeatures'>
  optionIndex: string
}

export interface GetSectionOptionsResult<T> {
  options: Array<{ id: string; label: string; value: string }>
  path: DeepKeyOf<T>
  label: string
  exist?: string // Making this optional since it might not always be set
}

export interface GetFeatureOptionsProps {
  feature: CharacterFeature
  optionIndex: string
}

export interface GetFeatureOptionsResult<T> {
  options: Array<{ id: string; label: string; value: string }>
  path: DeepKeyOf<T>
  exist?: string // Making this optional since it might not always be set
}

type OptionHandler = {
  [key in Exclude<SectionName, 'ancestries' | 'options' | 'subfeatures'>]: {
    canHandle: (section: SectionDataType, sectionStep?: SectionName) => boolean
    getOptions: (
      section: SectionDataType,
      sectionStep: SectionName
    ) => { options: Array<{ id: string; label: string; value: string }>; label: string }
  }
}

type Existing = {
  index: number
  optionIndex?: string
  optionId?: string
  id?: string
  featureLevel?: number
}

interface StateSections {
  [key: string]: Existing[]
}

export const sectionIds = ['classId', 'raceId', 'backgroundId', 'equipmentId', 'ancestryId', 'featId'] as const

const useGetSections = ({ formData }: { formData: Character }) => {
  const { data: classes } = useListClassesQuery()
  const { data: system } = useGetSystemQuery()
  const { data: spells } = useListSpellsQuery()
  const { data: races } = useListRacesQuery()
  const { data: feats } = useListFeatsQuery()
  const { data: equipment } = useListEquipmentQuery()
  const { data: backgrounds } = useListBackgroundsQuery()

  const { createFeatures, getFullFeature } = useGetFeatures({ data: formData })

  const features = createFeatures()

  const getStateSections = useMemo(() => {
    const existing: StateSections = {}
    sectionSteps.forEach((sectionStep: Exclude<SectionName, 'ancestries' | 'options' | 'subfeatures' | 'spells'>) => {
      existing[sectionStep] = []

      const sections = formData[sectionStep]
      sections?.forEach((section, index) => {
        let fullSections: Array<FeatureProficiency | FeatureSense | FeatureModifier | FeatureFeat | FeatureExpertise>
        let fullFeature: Feature | FeatureOption | AncestryFeature
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

        const existingSection: {
          index: number
          optionIndex?: string
          optionId?: string
          id?: string
          featureLevel?: number
        } = {
          index,
        }

        const getSectionId = (section: any) => {
          // Map of property names to check for
          const idProperties = [
            { check: (s: any) => s.__typename === 'CharacterFeat', getId: (s: any) => s.featId },
            { check: (s: any) => 'expertiseId' in s, getId: (s: any) => s.expertiseId },
            { check: (s: any) => 'proficiencyId' in s, getId: (s: any) => s.proficiencyId },
            { check: (s: any) => 'senseId' in s, getId: (s: any) => s.senseId },
            { check: (s: any) => 'modifierId' in s, getId: (s: any) => s.modifierId },
          ]

          // Find the first matching property and return its ID
          const match = idProperties.find((prop) => prop.check(section))
          return match ? match.getId(section) : undefined
        }

        existingSection.id = getSectionId(section)

        if (optionId) {
          existingSection.optionId = optionId
        }
        if (optionIndex) {
          existingSection.optionIndex = optionIndex
        }
        if (featureLevel) {
          existingSection.featureLevel = featureLevel
        }

        existing[sectionStep].push(existingSection)

        if (classId) {
          const fullClass = classes?.find((uClass) => uClass.id === classId)

          if (!featureId && sectionStep === 'proficiencies') {
            fullSections = fullClass?.proficiencies
          } else {
            fullFeature = fullClass?.features?.find((feature) => feature.id === featureId)
          }
        }
        if (raceId) {
          const fullRace = races?.find((race) => race.id === raceId)
          if (ancestryId) {
            const fullAncestry = fullRace?.ancestry?.options?.find((option) => option.id === ancestryId)

            fullFeature = fullAncestry?.features.find((feature) => feature.id === featureId)
          } else {
            fullFeature = fullRace?.features?.find((feature) => feature.id === featureId)
          }
        }
        if (featId) {
          const fullFeat = feats?.find((feat) => feat.id === featId)

          fullFeature = fullFeat?.features?.find((feature) => feature.id === featureId)
        }
        if (backgroundId) {
          const fullBackground = backgrounds?.find((background) => background.id === backgroundId)

          fullFeature = fullBackground?.features?.find((feature) => feature.id === featureId)
        }
        if (equipmentId) {
          const fullEquipment = equipment?.find((equipment) => equipment.id === equipmentId)

          fullFeature = fullEquipment?.features?.find((feature) => feature.id === featureId)
        }

        if ((fullFeature as Feature | AncestryFeature)?.options?.length > 0) {
          const optionId = formData?.features
            ?.find((f) => f.id === fullFeature?.id)
            ?.options?.find((o) => o.optionIndex === optionIndex)?.id

          fullSections = (fullFeature as Feature | AncestryFeature)?.options?.find(
            (option) => option.id === optionId
          )?.[sectionStep]
        }

        fullSections?.forEach((fullSection, sIndex) => {
          if (fullSection.__typename === 'FeatureProficiency' || fullSection.__typename === 'FeatureExpertise') {
            const categorySection = fullFeature?.[sectionStep as 'proficiencies' | 'expertise']?.find((step) => {
              if (section.__typename === 'CharacterProficiency') {
                return step.id === section.proficiencyId
              }
              if (section.__typename === 'CharacterExpertise') {
                return step.id === section.expertiseId
              }
            })

            const categoryId = categorySection?.category
            const categoryName = getKeyFromId(categoryId, ProficiencyCategories)

            // If the sections do not provide options, pass the set ids from the category/subcategory
            // The ones that did provides options are already set in the above in if options condition
            if (!fullSection?.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
              if (
                fullSection.id === (section as CharacterProficiency).proficiencyId ||
                fullSection.id === (section as CharacterExpertise).expertiseId
              ) {
                if (categoryName && categoryName !== 'initiative') {
                  if (categoryName === 'equipment') {
                    const proficiencyState = fullSection[categoryName]
                    for (const id in proficiencyState.ids) {
                      existing[sectionStep as 'proficiencies' | 'expertise'].push({ index: sIndex, id })
                    }
                  } else if (categoryName === 'properties') {
                    const proficiencyState = fullSection[categoryName]
                    for (const property in proficiencyState.properties) {
                      existing[sectionStep as 'proficiencies' | 'expertise'].push({ index: sIndex, id: property })
                    }
                  } else {
                    // If the proficiency is skills, saveAbilities, or languages, pass the ids
                    for (const id in fullSection[categoryName]) {
                      existing[sectionStep as 'proficiencies' | 'expertise'].push({ index: sIndex, id: id })
                    }
                  }
                }
              }
            }
          } else {
            // If the sections do not provide options, pass the set ids from the category/subcategory
            // The ones that did provides options are already set in the above in if options condition
            if (!fullSection?.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
              const sectionId = `${typename(sectionStep, 'id')}Id` as const
              if (sectionId in section) {
                if (fullSection.id === section[sectionId as keyof typeof section]) {
                  existing[sectionStep].push({ index: sIndex, id: fullSection.id })
                }
              }
            }
          }
        })
      })
    })

    return existing
  }, [classes, equipment, feats, backgrounds, formData, races])

  // Private helper functions
  const optionHandlers = useMemo((): OptionHandler => {
    let options: Array<{ id: string; label: string; value: string }> = []
    return {
      proficiencies: {
        canHandle: (section: SectionDataType, sectionStep: SectionName) =>
          section.__typename === 'FeatureProficiency' && sectionStep === 'proficiencies',
        getOptions: (section: FeatureProficiency) => {
          // Get the category name based on the available enums and the id in the data
          const categoryId = section.category
          const categoryName = getKeyFromId(categoryId, ProficiencyCategories)

          // If the Proficiency options are equipment or properties (equipment properties), these are handled differently due to potential filtering options
          if (categoryName === 'equipment' || categoryName === 'properties') {
            const categoryData = section[categoryName]

            if ('ids' in categoryData || 'properties' in categoryData) {
              const { properties, ids, category: equipmentCategory } = categoryData

              if ('ids' in categoryData) {
                if (ids.some((id) => id === 'all')) {
                  options = equipment
                    .filter((sEquipment) => sEquipment?.category === equipmentCategory)
                    .filter((sEquipment) => {
                      if (properties?.length > 0) {
                        return sEquipment?.properties?.some((property) => properties.includes(property))
                      }
                      return true
                    })
                } else {
                  options = equipment.filter((equipment) => ids.includes(equipment.id))
                }
              } else {
                options =
                  ids.some((id) => id === 'all') ?
                    system.equipment.properties
                  : system.equipment.properties.filter((property) => ids.includes(property.id))
              }
            }
          } else if (categoryName === 'saveAbilities') {
            if (section[categoryName]?.some((saveAbility) => saveAbility === 'all')) {
              options = system.abilities
            } else {
              options = system.abilities.filter((ability) => section[categoryName]?.includes(ability.id))
            }
            // Find all other proficient options that are not initiative
          } else if (categoryName !== 'initiative') {
            if (section[categoryName]?.some((cOption) => cOption === 'all')) {
              options = system[categoryName]
            } else {
              options = system[categoryName]?.filter((cOption) => section[categoryName]?.includes(cOption.id))
            }
          }
          return {
            options,
            label: system.proficiencies.categories.find((sCategory) => sCategory.id === categoryId)?.label,
          }
        },
      },
      expertise: {
        canHandle: (section: SectionDataType, sectionStep: SectionName) =>
          section.__typename === 'FeatureExpertise' && sectionStep === 'expertise',
        getOptions: (section: FeatureProficiency) => {
          // Get the category name based on the available enums and the id in the data
          const categoryId = section.category
          const categoryName = getKeyFromId(categoryId, ProficiencyCategories)

          // If the Proficiency options are equipment or properties (equipment properties), these are handled differently due to potential filtering options
          if (categoryName === 'equipment' || categoryName === 'properties') {
            const categoryData = section[categoryName]

            if ('ids' in categoryData || 'properties' in categoryData) {
              const { properties, ids, category: equipmentCategory } = categoryData

              if ('ids' in categoryData) {
                if (ids.some((id) => id === 'all')) {
                  options = equipment
                    .filter((sEquipment) => sEquipment?.category === equipmentCategory)
                    .filter((sEquipment) => {
                      if (properties?.length > 0) {
                        return sEquipment?.properties?.some((property) => properties.includes(property))
                      }
                      return true
                    })
                } else {
                  options = equipment.filter((equipment) => ids.includes(equipment.id))
                }
              } else {
                options =
                  ids.some((id) => id === 'all') ?
                    system.equipment.properties
                  : system.equipment.properties.filter((property) => ids.includes(property.id))
              }
            }
          } else if (categoryName === 'saveAbilities') {
            if (section[categoryName]?.some((saveAbility) => saveAbility === 'all')) {
              options = system.abilities
            } else {
              options = system.abilities.filter((ability) => section[categoryName]?.includes(ability.id))
            }
            // Find all other proficient options that are not initiative
          } else if (categoryName !== 'initiative') {
            if (section[categoryName]?.some((cOption) => cOption === 'all')) {
              options = system[categoryName]
            } else {
              options = system[categoryName]?.filter((cOption) => section[categoryName]?.includes(cOption.id))
            }
          }
          return {
            options,
            label: system.proficiencies.categories.find((sCategory) => sCategory.id === categoryId)?.label,
          }
        },
      },
      modifiers: {
        canHandle: (section: SectionDataType, sectionStep: SectionName) =>
          section.__typename === 'FeatureModifier' && sectionStep === 'modifiers',
        getOptions: (section: FeatureModifier) => {
          // Get category name based on the ID and using the enums to match for a property key
          const categoryId = section.category
          const categoryName = getKeyFromId(categoryId, { ...ModifierCategories, ...ModifierSpellCategories })

          // Match a property name to the category name
          const propertyName = getModifierProperties({ category: categoryName })
          const property = section[propertyName]

          // Focus on the only ones that are arrays and therefore would be options
          if (
            propertyName !== 'spell' &&
            propertyName !== 'range' &&
            propertyName !== 'shape' &&
            propertyName !== 'duration'
          ) {
            if (Array.isArray(property)) {
              if (property.some((property) => property === 'all')) {
                if (propertyName === 'saveAbilities') {
                  options = system.abilities
                } else {
                  options = system[propertyName]
                }
              } else {
                if (propertyName === 'saveAbilities') {
                  options = system.abilities.filter((ability) => section[propertyName]?.includes(ability.id))
                } else {
                  options = system[propertyName]?.filter((ability) => section[propertyName]?.includes(ability.id))
                }
              }
            }
          }
          return {
            options,
            label: system.modifiers.categories.find((sCategory) => sCategory.id === categoryId)?.label,
          }
        },
      },
      feats: {
        canHandle: (section: SectionDataType, sectionStep: SectionName) =>
          section.__typename === 'FeatureFeat' && sectionStep === 'feats',
        getOptions: (section: FeatureFeat) => {
          if (section.feats.some((feat) => feat === 'all')) {
            options = feats
          } else {
            options = feats.filter((feat) => section.feats.includes(feat.id))
          }
          return {
            options,
            label: 'Feat',
          }
        },
      },
      senses: {
        canHandle: (section: SectionDataType, sectionStep: SectionName) =>
          section.__typename === 'FeatureSense' && sectionStep === 'senses',
        getOptions: (section: FeatureSense) => {
          {
            if (section.ids.some((sense) => sense === 'all')) {
              options = system.senses
            } else {
              options = system.senses.filter((sense) => section.ids.includes(sense.id))
            }
            return {
              options,
              label: 'Sense',
            }
          }
        },
      },
      spells: {
        canHandle: (section: SectionDataType, sectionStep: SectionName) =>
          section.__typename === 'FeatureSpell' && sectionStep === 'spells',
        getOptions: (section: FeatureSpell) => {
          if (section.ids.some((spell) => spell === 'all')) {
            options = spells
          } else {
            options = spells.filter((spell) => section.ids.includes(spell.id))
          }
          if (section.attributes?.some((attribute) => attribute === Attributes.classLimit)) {
            options = (options as Array<Spell>).filter((option) =>
              option.classes?.some((oClass) => section.classLimit?.some((lClass) => lClass === oClass))
            )
          }

          if (section.attributes?.some((attribute) => attribute === Attributes.levelLimit)) {
            options = (options as Array<Spell>).filter((spell) => section.levelLimit.includes(String(spell.level)))
          }

          return {
            options,
            label: 'Spell',
          }
        },
      },
    }
  }, [equipment, system, feats, spells])

  // Grouped by domain
  // Option-related functions
  const getSectionOptions = ({
    section,
    sectionStep,
    optionIndex,
  }: GetSectionOptionsProps): GetSectionOptionsResult<typeof formData> => {
    const existing = getStateSections
    let options: Array<{ id: string; label: string; value: string }> = []
    let label = ''
    let path: DeepKeyOf<typeof formData>
    let exist: string

    const stateIndex = formData[sectionStep as Exclude<typeof sectionStep, 'spells'>]?.length || 0

    const handlers = Object.values(optionHandlers)
    const handler = handlers.find((handler) => handler.canHandle(section, sectionStep))

    if (handler) {
      const result = handler.getOptions(section, sectionStep)
      options = result.options
      label = result.label
    }

    if (sectionStep === 'expertise') {
      options = options?.filter((option) =>
        existing.proficiencies.flatMap((existing) => existing.id).includes(option.id)
      )
    }

    options = options?.filter((option) => {
      const existingSelection = existing[sectionStep].find((existObj) => existObj.id === option.id)
      return !existingSelection || existingSelection.optionIndex === optionIndex
    })

    if (sectionStep === 'spells') {
      const stateIndex = formData?.spellcasting?.additional?.length || 0

      path = `spellcasting.additional.${stateIndex}`

      exist = formData.spellcasting.additional?.find((spell) => spell.optionIndex === optionIndex).id

      if (exist != null) {
        const existIndex = formData.spellcasting.additional?.findIndex((section) => section.optionIndex === optionIndex)

        path = `spellcasting.additional.${existIndex}`
      }
    } else {
      const existOption = existing[sectionStep].find((existObj) => existObj.optionIndex === optionIndex)

      path = `${sectionStep}.${stateIndex}`

      if (existOption?.index > -1) {
        path = `${sectionStep}.${existOption.index}`
        exist = existOption.id
      }
    }

    return { options, path, label, exist }
  }

  const createSections = useCallback(() => {
    // Initialize with existing data and validate against current formData// Common validation function for all section types
    const isValidSection = (
      section: CharacterExpertise | CharacterFeat | CharacterSense | CharacterProficiency | CharacterModifier
    ) => {
      const sourceValid =
        (section.classId && formData?.classes?.some((c) => c.id === section.classId)) ||
        (section.raceId && section.raceId === formData.race) ||
        (section.ancestryId && section.ancestryId === formData.ancestry?.id) ||
        (section.backgroundId && section.backgroundId === formData?.background)

      const optionValid =
        !section.optionId ||
        formData?.features?.find((f) => f.id === section.featureId)?.options?.some((o) => o.id === section.optionId)

      return sourceValid && optionValid
    }

    // Create sections object with explicit typing
    const sections = {
      feats: [...(formData.feats || [])].filter(isValidSection) as CharacterFeat[],
      modifiers: [...(formData.modifiers || [])].filter(isValidSection) as CharacterModifier[],
      proficiencies: [...(formData.proficiencies || [])].filter(isValidSection) as CharacterProficiency[],
      expertise: [...(formData.expertise || [])].filter(isValidSection) as CharacterExpertise[],
      senses: [...(formData.senses || [])].filter(isValidSection) as CharacterSense[],
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
    function pushToSection<K extends keyof typeof sections>(step: K, obj: CharacterSectionData): void {
      const idKey = sectionIdKey(step)

      // Type guard using the existing sections object type
      function isSectionType<T extends keyof typeof sections>(
        obj: CharacterSectionData,
        section: T
      ): obj is (typeof sections)[T][number] {
        return obj.__typename === typename(section, 'typename')
      }

      const exists = sections[step].some((section) => {
        if (hasProperty(section, idKey)) {
          // Basic check for general section identity
          const basicMatch =
            hasProperty(section, 'featureId') &&
            hasProperty(obj, 'featureId') &&
            section.featureId === obj.featureId &&
            getProperty(section, idKey) === getProperty(obj, idKey)

          // For proficiencies and expertise, also check the specific target identifier
          if (step === 'proficiencies' || step === 'expertise') {
            // Get all category identifiers from the typenameMap
            const categoryIdentifiers: Exclude<keyof typeof ProficiencyCategories, 'initiative'>[] = Object.keys(
              ProficiencyCategories
            ).filter((key: keyof typeof ProficiencyCategories) => key !== 'initiative') // Exclude initiative which doesn't have IDs

            // Find common properties
            const commonProps = categoryIdentifiers.filter(
              (prop) => hasProperty(section, prop) && hasProperty(obj, prop)
            )

            // If we have common properties, verify they match
            if (commonProps.length > 0) {
              return commonProps.every((prop) => getProperty(section, prop) === getProperty(obj, prop))
            }
          }

          return basicMatch
        }
        return false
      })

      if (!exists) {
        if (isSectionType(obj, step)) {
          // Get a reference to the array with the correct type
          const sectionArray = sections[step] as Array<(typeof sections)[typeof step][number]>
          // Push to it (this modifies the original array)
          sectionArray.push(obj as (typeof sections)[typeof step][number])
          // No need to reassign
        } else {
          console.warn(`Attempted to add object with wrong type to ${step} section`)
        }
      }
    }

    // Process features...
    const pushSections = (fullFeature: Feature | AncestryFeature | FeatureOption, feature: FactoryFeature) => {
      // For each valid section type
      const featureObject: FactoryFeature & { __typename: 'CharacterFeature' } = {
        ...feature,
        __typename: 'CharacterFeature',
      }
      sectionSteps
        .filter((step) => step !== 'spells')
        .forEach((sectionStep) => {
          if (fullFeature?.[sectionStep]?.length > 0) {
            fullFeature[sectionStep].forEach((fSection) => {
              if (!fSection?.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
                // Special handling for proficiencies and expertise
                if (
                  (fSection.__typename === 'FeatureProficiency' || fSection.__typename === 'FeatureExpertise') &&
                  fSection.category
                ) {
                  const categoryId = fSection.category
                  const categoryName = getKeyFromId(categoryId, ProficiencyCategories)

                  // Handle different category types that contain arrays
                  if (categoryName && categoryName !== 'initiative') {
                    if (categoryName === 'equipment' && fSection.equipment?.ids) {
                      // Handle equipment IDs array
                      fSection.equipment.ids.forEach((equipId) => {
                        if (equipId !== 'all') {
                          const sectionObject = createBaseSectionObject(
                            sectionStep as 'proficiencies' | 'expertise',
                            fSection,
                            fullFeature,
                            featureObject
                          )
                          sectionObject.equipment = equipId
                          pushToSection(sectionStep, sectionObject)
                        }
                      })
                    } else if (categoryName === 'properties' && fSection.properties?.properties) {
                      // Handle properties array
                      fSection.properties.properties.forEach((propId) => {
                        if (propId !== 'all') {
                          const sectionObject = createBaseSectionObject(
                            sectionStep as 'proficiencies' | 'expertise',
                            fSection,
                            fullFeature,
                            featureObject
                          )
                          sectionObject.property = propId
                          pushToSection(sectionStep, sectionObject)
                        }
                      })
                    } else if (fSection[categoryName] && Array.isArray(fSection[categoryName])) {
                      // Handle other arrays like skills, saveAbilities, languages
                      fSection[categoryName].forEach((itemId) => {
                        if (itemId !== 'all') {
                          const sectionObject = createBaseSectionObject(
                            sectionStep as 'proficiencies' | 'expertise',
                            fSection,
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
                      const sectionObject = createBaseSectionObject(sectionStep, fSection, fullFeature, featureObject)
                      pushToSection(sectionStep, sectionObject)
                    }
                  } else {
                    // Handle initiative or unknown category
                    const sectionObject = createBaseSectionObject(sectionStep, fSection, fullFeature, featureObject)
                    pushToSection(sectionStep, sectionObject)
                  }
                } else {
                  // Normal case for non-proficiency/expertise sections
                  const sectionObject = createBaseSectionObject(sectionStep, fSection, fullFeature, featureObject)
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
      fSection: FeatureModifier | FeatureFeat | FeatureSense | FeatureProficiency | FeatureExpertise,
      fullFeature: Feature | AncestryFeature | FeatureOption,
      feature: CharacterFeature
    ): (typeof sections)[T][number] {
      // Use the specific return type based on the section type
      const typeName = typename(sectionStep, 'typename')

      // Create the base object with the required type
      const sectionObject = {
        __typename: typeName,
        [`${sectionIdKey(sectionStep)}`]: fSection.id,
        featureId: fullFeature.id,
      }

      // Add source IDs
      sectionIds.forEach((sourceKey) => {
        if (feature?.[sourceKey]) sectionObject[sourceKey] = feature[sourceKey]
      })

      return sectionObject as (typeof sections)[typeof sectionStep][number]
    }

    features?.forEach((feature) => {
      const fullFeature = getFullFeature(feature)
      pushSections(fullFeature, feature)

      if (feature?.options?.length > 0) {
        feature?.options?.forEach((option) => {
          const fullOption = getFullFeature(feature)?.options?.find((o) => o.id === option.id)

          if (fullOption) {
            pushSections(fullOption, feature)
          }
        })
      }
    })

    formData?.classes?.forEach((fClass) => {
      const fullClass = classes?.find((c) => c.id === fClass.id)

      const proficiencies = fullClass?.proficiencies || []

      proficiencies?.forEach((proficiency) => {
        const exist = sections.proficiencies.find((s) => s.classId === fClass.id && s.proficiencyId === proficiency.id)

        if (exist) return

        const sectionObject = {
          __typename: 'CharacterProficiency' as const,
          classId: fClass.id,
          proficiencyId: proficiency.id,
        }
        pushToSection('proficiencies', sectionObject)
      })
    })

    return sections
  }, [classes, formData, getFullFeature, features])

  const createAbilityScores = useCallback(() => {
    if (formData.__typename === 'Character') {
      const abilityScores: Scores[] = JSON.parse(
        JSON.stringify(formData?.abilities?.scores || [])
      ) as Character['abilities']['scores']

      const characterModifiers = [...(formData?.modifiers || [])]

      abilityScores?.forEach((score, index) => {
        // Set the calculated score

        let calculatedScore: number = Number(score.baseScore) || 0
        let raceScore: number = 0
        let classScore: number = 0
        let modifierScore: number = 0

        // Set modifers on ability scores

        characterModifiers?.forEach((cModifier) => {
          let charClass: Class
          let charRace: Race
          let charAncestry: AncestryOption
          let featureMod: FeatureModifier

          if (cModifier.classId) {
            charClass = classes?.find((sClass) => sClass.id === cModifier.classId)
            featureMod = charClass?.features
              ?.find(
                (feature) =>
                  feature.id === cModifier.featureId &&
                  feature.levelAvailable
                    .split(/\s*,\s*/)
                    .includes(String(formData?.classes?.find((fClass) => fClass.id === cModifier.classId)?.level))
              )
              ?.modifiers?.find((modifier) => modifier.id === cModifier.modifierId)
          }
          if (cModifier.raceId) {
            charRace = races.find((sRace) => sRace.id === cModifier.raceId)
            featureMod = charRace?.features
              ?.find((feature) => feature.id === cModifier.featureId)
              ?.modifiers?.find((modifier) => modifier.id === cModifier.modifierId)
          }
          if (cModifier.ancestryId) {
            charAncestry = charRace?.ancestry?.options?.find((option) => option.id === cModifier.ancestryId)
            featureMod = charAncestry?.features
              ?.find((feature) => feature.id === cModifier.featureId)
              ?.modifiers?.find((modifier) => modifier.id === cModifier.modifierId)
          }

          let method: FeatureModifier['method']
          let type: FeatureModifier['type']
          if (featureMod && featureMod.category === ModifierCategories.abilityScores) {
            method = featureMod.method
            type = featureMod.type

            if (type === ModifierTypes.bonus) {
              if (method === ModifierMethods.setGlobally) {
                if (featureMod?.abilities && featureMod?.abilities?.includes(score.ability)) {
                  if (cModifier.classId != null) {
                    classScore += featureMod.setAmount
                    modifierScore += featureMod.setAmount
                  }
                  if (cModifier.raceId != null) {
                    raceScore += featureMod.setAmount
                    modifierScore += featureMod.setAmount
                  }
                }
              }
            }
          }
        })

        calculatedScore += raceScore
        calculatedScore += classScore

        if (calculatedScore !== score.calculatedScore || !score.calculatedScore) {
          abilityScores[index] = {
            ...score,
            calculatedScore: calculatedScore,
            raceScore: raceScore,
            classScore: classScore,
            modifierScore: modifierScore,
          }
        }
      })

      return abilityScores
    }
  }, [classes, formData.__typename, races, formData?.modifiers, formData?.abilities?.scores, formData?.classes])

  return {
    getSectionOptions,
    createSections,
    createAbilityScores,
    features,
  }
}
export default useGetSections
