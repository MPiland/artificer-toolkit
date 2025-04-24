import type {
  CharacterSectionData,
  DeepKeyOf,
  SectionDataType,
  SectionName,
  FeatureDataType,
  Character,
  CharacterFeature,
  Spell,
  Feature,
  AncestryFeature,
  FeatureModifier,
  Scores,
  CharacterExpertise,
  CharacterProficiency,
  CharacterSense,
  CharacterModifier,
  CharacterFeat,
} from '@/types'
import { getKeyFromId, getModifierProperties, sectionSteps } from '@/components/Form'
import { useCallback, useMemo } from 'react'
import { typename, sectionIdKey, proficiencyKey } from '@/utils'
import {
  useBackgroundData,
  useClassData,
  useEquipmentData,
  useFeatData,
  useGetFeatures,
  useRaceData,
  useSpellData,
  useSystemData,
  type FactoryFeature,
} from '@/hooks'
import { ProfCats, Attributes, ModMethods, ModTypes, ModCats, ModSpellCats } from '@/enums'
import { camelCase } from 'lodash'
import { CamelCase } from 'type-fest'

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
    canHandle: (section: SectionDataType, sectionStep: SectionName) => boolean
    getOptions: (section: SectionDataType) => {
      options: Array<{ id: string; label: string; value: string }>
      label: string
    }
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
  const { classes } = useClassData()
  const { system } = useSystemData()
  const { spells } = useSpellData()
  const { races } = useRaceData()
  const { feats } = useFeatData()
  const { equipment } = useEquipmentData()
  const { backgrounds } = useBackgroundData()

  const { createFeatures, getFullFeature } = useGetFeatures({ data: formData })

  const features = createFeatures()

  const getStateSections = useMemo(() => {
    const existing: StateSections = {}
    sectionSteps
      .filter((sectionStep) => sectionStep !== 'spells')
      .forEach((sectionStep) => {
        existing[sectionStep] = []

        const sections = formData[sectionStep]
        sections?.forEach((section, index) => {
          let fullSections: Array<SectionDataType> = []
          let fullFeature = {} as FeatureDataType
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
            const fullClass = classes?.findClass(classId)

            if (!featureId && sectionStep === 'proficiencies' && fullClass?.proficiencies?.length) {
              fullSections = fullClass?.proficiencies
            } else {
              const classFeature = fullClass?.features?.find((feature) => feature.id === featureId)

              if (classFeature) {
                fullFeature = classFeature
              }
            }
          }
          if (raceId) {
            const fullRace = races?.findRace(raceId)

            if (ancestryId) {
              const fullAncestry = fullRace?.ancestry?.options?.find((option) => option.id === ancestryId)

              if (fullAncestry) {
                const ancestryFeature = fullAncestry?.features?.find((feature) => feature.id === featureId)

                if (ancestryFeature) {
                  fullFeature = ancestryFeature
                }
              }
            } else {
              const raceFeature = fullRace?.features?.find((feature) => feature.id === featureId)

              if (raceFeature) {
                fullFeature = raceFeature
              }
            }
          }
          if (featId) {
            const fullFeat = feats?.findFeat(featId)

            const featFeature = fullFeat?.features?.find((feature) => feature.id === featureId)

            if (featFeature) {
              fullFeature = featFeature
            }
          }
          if (backgroundId) {
            const fullBackground = backgrounds?.findBackground(backgroundId)

            const backgroundFeature = fullBackground?.features?.find((feature) => feature.id === featureId)

            if (backgroundFeature) {
              fullFeature = backgroundFeature
            }
          }
          if (equipmentId) {
            const fullEquipment = equipment?.findEquipment(equipmentId)

            const equipmentFeature = fullEquipment?.features?.find((feature) => feature.id === featureId)

            if (equipmentFeature) {
              fullFeature = equipmentFeature
            }
          }

          if (
            fullFeature.__typename === 'Feature' ||
            (fullFeature.__typename === 'AncestryFeature' && fullFeature?.options?.length)
          ) {
            const optionId = formData?.features
              ?.find((f) => f.id === fullFeature?.id)
              ?.options?.find((o) => o.optionIndex === optionIndex)?.id

            const sections = (fullFeature as Feature | AncestryFeature)?.options?.find(
              (option) => option.id === optionId
            )?.[sectionStep]

            if (sections?.length) {
              fullSections = sections
            }
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

              if (!categoryId) return

              const categoryName = getKeyFromId(categoryId, ProfCats)

              // If the sections do not provide options, pass the set ids from the category/subcategory
              // The ones that did provides options are already set in the above in if options condition
              if (!fullSection?.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS)) {
                if (
                  fullSection.id === (section as CharacterProficiency).proficiencyId ||
                  fullSection.id === (section as CharacterExpertise).expertiseId
                ) {
                  if (categoryName && categoryName !== 'initiative') {
                    if (categoryName === 'equipment') {
                      const proficiencyState = fullSection[categoryName]
                      if (proficiencyState) {
                        for (const id in proficiencyState.ids) {
                          existing[sectionStep as 'proficiencies' | 'expertise'].push({ index: sIndex, id })
                        }
                      }
                    } else if (categoryName === 'properties') {
                      const proficiencyState = fullSection[categoryName]
                      if (proficiencyState) {
                        for (const property in proficiencyState.properties) {
                          existing[sectionStep as 'proficiencies' | 'expertise'].push({ index: sIndex, id: property })
                        }
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
              if (!fullSection?.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS)) {
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
        canHandle: (section, sectionStep) =>
          section.__typename === 'FeatureProficiency' && sectionStep === 'proficiencies',
        getOptions: (section) => {
          if (section.__typename !== 'FeatureProficiency')
            return {
              options: [],
              label: '',
            }
          // Get the category name based on the available enums and the id in the data
          const categoryId = section.category
          const categoryName = getKeyFromId(categoryId, ProfCats)

          // If the Proficiency options are equipment or properties (equipment properties), these are handled differently due to potential filtering options
          if (categoryName === 'equipment' || categoryName === 'properties') {
            const categoryData = section[categoryName]

            if (categoryData && ('ids' in categoryData || 'properties' in categoryData)) {
              const { properties, ids, category: equipmentCategory } = categoryData

              if (categoryName === 'equipment') {
                if (ids?.some((id) => id === 'all')) {
                  options = equipment.filterByCategory(equipmentCategory).filterByProperties(properties)
                } else {
                  options = equipment.filter((equipment) => ids?.includes(equipment.id))
                }
              } else {
                options =
                  ids?.some((id) => id === 'all') ?
                    system.equipment.properties
                  : system.equipment.properties.filter((property) => ids?.includes(property.id))
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
            label: system.proficiencies.categories.find((sCategory) => sCategory.id === categoryId)?.label || '',
          }
        },
      },
      expertise: {
        canHandle: (section, sectionStep) => section.__typename === 'FeatureExpertise' && sectionStep === 'expertise',
        getOptions: (section) => {
          if (section.__typename !== 'FeatureExpertise')
            return {
              options: [],
              label: '',
            }
          // Get the category name based on the available enums and the id in the data
          const categoryId = section.category
          const categoryName = getKeyFromId(categoryId, ProfCats)

          // If the Proficiency options are equipment or properties (equipment properties), these are handled differently due to potential filtering options
          if (categoryName === 'equipment' || categoryName === 'properties') {
            const categoryData = section[categoryName]

            if (categoryData && ('ids' in categoryData || 'properties' in categoryData)) {
              const { properties, ids, category: equipmentCategory } = categoryData

              if (categoryName === 'equipment') {
                if (ids?.some((id) => id === 'all')) {
                  options = equipment.filterByCategory(equipmentCategory).filterByProperties(properties)
                } else {
                  options = equipment.filter((equipment) => ids?.includes(equipment.id))
                }
              } else {
                options =
                  ids?.some((id) => id === 'all') ?
                    system.equipment.properties
                  : system.equipment.properties.filter((property) => ids?.includes(property.id))
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
            label: system.proficiencies.categories.find((sCategory) => sCategory.id === categoryId)?.label || '',
          }
        },
      },
      modifiers: {
        canHandle: (section, sectionStep) => section.__typename === 'FeatureModifier' && sectionStep === 'modifiers',
        getOptions: (section) => {
          const returnObject = {
            options: [],
            label: '',
          }
          if (section.__typename !== 'FeatureModifier') return returnObject
          // Get category name based on the ID and using the enums to match for a property key
          const categoryId = section.category

          if (!categoryId) return returnObject

          const categoryName = getKeyFromId(categoryId, { ...ModCats, ...ModSpellCats })

          // Match a property name to the category name
          const propertyName = getModifierProperties({ category: categoryName })

          if (!propertyName) return returnObject

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
            label: system.modifiers.categories.find((sCategory) => sCategory.id === categoryId)?.label || '',
          }
        },
      },
      feats: {
        canHandle: (section, sectionStep) => section.__typename === 'FeatureFeat' && sectionStep === 'feats',
        getOptions: (section) => {
          if (section.__typename !== 'FeatureFeat') return { options: [], label: '' }
          if (section?.feats?.some((feat) => feat === 'all')) {
            options = feats
          } else {
            options = feats.filter((feat) => section?.feats?.includes(feat.id))
          }
          return {
            options,
            label: 'Feat',
          }
        },
      },
      senses: {
        canHandle: (section, sectionStep) => section.__typename === 'FeatureSense' && sectionStep === 'senses',
        getOptions: (section) => {
          if (section.__typename !== 'FeatureSense') return { options: [], label: '' }
          {
            if (section?.ids?.some((sense) => sense === 'all')) {
              options = system.senses
            } else {
              options = system.senses.filter((sense) => section?.ids?.includes(sense.id))
            }
            return {
              options,
              label: 'Sense',
            }
          }
        },
      },
      spells: {
        canHandle: (section, sectionStep) => section.__typename === 'FeatureSpell' && sectionStep === 'spells',
        getOptions: (section) => {
          if (section.__typename !== 'FeatureSpell') return { options: [], label: '' }
          if (section?.ids?.some((spell) => spell === 'all')) {
            options = spells
          } else {
            options = spells.filter((spell) => section?.ids?.includes(spell.id))
          }
          if (section.attributes?.some((attribute) => attribute === Attributes.CLASS_LIMIT)) {
            options = (options as Array<Spell>).filter((option) =>
              option.classes?.some((oClass) => section.classLimit?.some((lClass) => lClass === oClass))
            )
          }

          if (section.attributes?.some((attribute) => attribute === Attributes.LEVEL_LIMIT)) {
            options = (options as Array<Spell>).filter((spell) => section?.levelLimit?.includes(String(spell.level)))
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
    let exist: string | undefined

    const stateIndex = formData[sectionStep as Exclude<typeof sectionStep, 'spells'>]?.length || 0

    const handlers = Object.values(optionHandlers)
    const handler = handlers.find((handler) => handler.canHandle(section, sectionStep))

    if (handler) {
      const result = handler.getOptions(section)
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

      exist = formData?.spellcasting?.additional?.find((spell) => spell.optionIndex === optionIndex)?.id

      if (exist != null) {
        const existIndex = formData?.spellcasting?.additional?.findIndex(
          (section) => section.optionIndex === optionIndex
        )

        if (existIndex && existIndex > -1) {
          path = `spellcasting.additional.${existIndex}`
        }
      }
    } else {
      const existOption = existing[sectionStep].find((existObj) => existObj.optionIndex === optionIndex)

      path = `${sectionStep}.${stateIndex}`

      if (existOption && existOption?.index > -1) {
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
            const categoryIdentifiers = Object.keys(ProfCats)
              .filter((key) => {
                const typedKey = camelCase(key) as CamelCase<keyof typeof ProfCats>
                return typedKey !== 'initiative'
              })
              .map((key) => {
                const typedKey = key as keyof typeof ProfCats
                return typedKey
              }) // Exclude initiative which doesn't have IDs

            // Find common properties
            const commonProps = categoryIdentifiers.filter(
              (prop) => hasProperty(section, prop) && hasProperty(obj, prop)
            )

            // If we have common properties, verify they match
            if (commonProps.length) {
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
    const pushSections = (fullFeature: FeatureDataType, feature: FactoryFeature) => {
      // For each valid section type
      const featureObject: FactoryFeature & { __typename: 'CharacterFeature' } = {
        ...feature,
        __typename: 'CharacterFeature',
      }
      sectionSteps
        .filter((step) => step !== 'spells')
        .forEach((sectionStep) => {
          if (fullFeature?.[sectionStep]?.length) {
            fullFeature[sectionStep].forEach((fSection) => {
              if (!fSection?.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS)) {
                // Special handling for proficiencies and expertise
                if (
                  (fSection.__typename === 'FeatureProficiency' || fSection.__typename === 'FeatureExpertise') &&
                  fSection.category
                ) {
                  const categoryId = fSection.category
                  const categoryName = getKeyFromId(categoryId, ProfCats)

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
      fSection: SectionDataType,
      fullFeature: FeatureDataType,
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
      if (fullFeature) {
        pushSections(fullFeature, feature)
      }

      if (feature?.options?.length) {
        feature?.options?.forEach((option) => {
          const fullOption = getFullFeature(feature)?.options?.find((o) => o.id === option.id)

          if (fullOption) {
            pushSections(fullOption, feature)
          }
        })
      }
    })

    formData?.classes?.forEach((fClass) => {
      const fullClass = classes?.findClass(fClass.id)

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
      const abilityScores: Scores[] =
        JSON.parse(JSON.stringify(formData?.abilities?.scores)) || ([] as NonNullable<Character['abilities']>['scores'])

      const characterModifiers = [...(formData?.modifiers || [])]

      abilityScores?.forEach((score, index) => {
        // Set the calculated score

        let calculatedScore: number = Number(score.baseScore) || 0
        let raceScore: number = 0
        let classScore: number = 0
        let modifierScore: number = 0

        // Set modifers on ability scores

        characterModifiers?.forEach((cModifier) => {
          let featureMod: FeatureModifier | undefined

          if (cModifier.classId) {
            const foundClass = classes?.findClass(cModifier.classId)
            if (foundClass) {
              const foundMod = foundClass?.features
                ?.find(
                  (feature) =>
                    feature.id === cModifier.featureId &&
                    feature.levelAvailable
                      ?.split(/\s*,\s*/)
                      .includes(String(formData?.classes?.find((fClass) => fClass.id === cModifier.classId)?.level))
                )
                ?.modifiers?.find((modifier) => modifier.id === cModifier.modifierId)
              if (foundMod) {
                featureMod = foundMod
              }
            }
          }
          if (cModifier.raceId) {
            const foundRace = races.findRace(cModifier.raceId)
            if (foundRace) {
              const foundMod = foundRace?.features
                ?.find((feature) => feature.id === cModifier.featureId)
                ?.modifiers?.find((modifier) => modifier.id === cModifier.modifierId)
              if (foundMod) {
                featureMod = foundMod
              }
              if (cModifier.ancestryId) {
                const foundAncestry = foundRace?.ancestry?.options?.find((option) => option.id === cModifier.ancestryId)
                if (foundAncestry) {
                  const foundMOd = foundAncestry?.features
                    ?.find((feature) => feature.id === cModifier.featureId)
                    ?.modifiers?.find((modifier) => modifier.id === cModifier.modifierId)
                  if (foundMOd) {
                    featureMod = foundMOd
                  }
                }
              }
            }
          }

          let method: FeatureModifier['method']
          let type: FeatureModifier['type']
          if (featureMod && featureMod.category === ModCats.ABILITY_SCORES) {
            method = featureMod.method
            type = featureMod.type

            if (type === ModTypes.BONUS) {
              if (method === ModMethods.SET_GLOBALLY) {
                if (featureMod?.abilities && featureMod?.abilities?.includes(score.ability) && featureMod.setAmount) {
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
