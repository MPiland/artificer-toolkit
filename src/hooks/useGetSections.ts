import type {
  CharacterSectionData,
  DeepKeyOf,
  SectionFormDataType,
  FeatureFormDataType,
  Character,
  CharacterFeature,
  Spell,
  FeatureModifier,
  CharacterInput,
  CharacterProficiencyInput,
  CharacterExpertiseInput,
  CharacterFeatInput,
  CharacterModifierInput,
  CharacterSenseInput,
  ScoresInput,
  FeatureProficiencyInput,
  FeatureExpertiseInput,
  CharacterSpellcastingInput,
  CharacterFeatureInput,
  SectionSourceDataType,
  FeatureOption,
  FeatureOptionInput,
  FeatureFeatInput,
  FeatureSpellInput,
  FeatureSenseInput,
  FeatureModifierInput,
} from '@/types'
import { getKeyFromId, getModifierProperties, SECTION_STEPS } from '@/components/Form'
import { useCallback, useMemo } from 'react'
import { kind, sectionIdKey, proficiencyKey } from '@/utils'
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
import {
  CharacterFeatInputSchema,
  CharacterFeatureInputSchema,
  FeatureInputSchema,
  FeatureProficiencyInputSchema,
  CharacterProficiencyInputSchema,
  CharacterExpertiseInputSchema,
  CharacterModifierInputSchema,
  CharacterSenseInputSchema,
  FeatureExpertiseInputSchema,
  FeatureFeatInputSchema,
  FeatureModifierInputSchema,
  FeatureSenseInputSchema,
  FeatureSpellInputSchema,
  FeatureOptionInputSchema,
  ScoresInputSchema,
} from '@/schemas'
import { z } from 'zod/v4'
import useFeatureData from './useFeatureData'
import useSectionData from './useSectionData'
import { DeepKeys } from '@tanstack/react-form'
import {
  useFeatureOptionStore,
  useFeatureSenseStore,
  useFeatureProficiencyStore,
  useFeatureSpellStore,
  useFeatureExpertiseStore,
  useFeatureModifierStore,
} from '@/store'
import { useFeatureFeatStore } from '@/store/featureFeatStore'

export interface GetSectionOptionsProps {
  data: {
    modifiers?: CharacterModifierInput[] | null
    expertise?: CharacterExpertiseInput[] | null
    proficiencies?: CharacterProficiencyInput[] | null
    senses?: CharacterSenseInput[] | null
    feats?: CharacterFeatInput[] | null
    spellcasting?: CharacterSpellcastingInput | null
    features?: CharacterFeatureInput[] | null
  }
  section: SectionFormDataType
  sectionStep: Exclude<(typeof SECTION_STEPS)[number], 'ancestries' | 'options' | 'subfeatures'>
  optionIndex: string
}

export interface GetSectionOptionsResult {
  options: Array<{ id: string; label: string }>
  path: DeepKeys<{
    modifiers: CharacterModifierInput[]
    expertise: CharacterExpertiseInput[]
    proficiencies: CharacterProficiencyInput[]
    senses: CharacterSenseInput[]
    feats: CharacterFeatInput[]
    spellcasting: CharacterSpellcastingInput
    features: CharacterFeatureInput[]
  }>
  label: string
  exist?: string // Making this optional since it might not always be set
}

export interface GetFeatureOptionsProps {
  feature: CharacterFeature
  optionIndex: string
}

export interface GetFeatureOptionsResult {
  options: Array<{ id: string; label: string }>
  path: DeepKeyOf<CharacterInput>
  exist?: string // Making this optional since it might not always be set
}

type OptionHandler = {
  [key in Exclude<(typeof SECTION_STEPS)[number], 'ancestries' | 'options' | 'subfeatures'>]: {
    canHandle: (section: SectionFormDataType, sectionStep: (typeof SECTION_STEPS)[number]) => boolean
    getOptions: (section: SectionFormDataType) => {
      options: Array<{ id: string; label: string }>
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

const characterSectionSchemas = z.discriminatedUnion('__kind', [
  CharacterProficiencyInputSchema,
  CharacterExpertiseInputSchema,
  CharacterModifierInputSchema,
  CharacterSenseInputSchema,
  CharacterFeatInputSchema,
])

export const sectionIds = ['classId', 'raceId', 'backgroundId', 'equipmentId', 'ancestryId', 'featId'] as const

const useGetSections = () => {
  const { classes } = useClassData()
  const { system } = useSystemData()
  const { spells } = useSpellData()
  const { races } = useRaceData()
  const { feats } = useFeatData()
  const { equipment } = useEquipmentData()
  const { backgrounds } = useBackgroundData()
  const optionStore = useFeatureOptionStore()
  const proficiencyStore = useFeatureProficiencyStore()
  const senseStore = useFeatureSenseStore()
  const spellStore = useFeatureSpellStore()
  const expertiseStore = useFeatureExpertiseStore()
  const modifierStore = useFeatureModifierStore()
  const featStore = useFeatureFeatStore()
  const { features: featureData, featureOptions, ancestryOptions } = useFeatureData()
  const { featureModifiers, featureExpertise, featureProficiencies, featureSenses, featureSpells, featureFeats } =
    useSectionData()

  type SectionTypeMapEntry = {
    get: (id: string) => SectionSourceDataType | FeatureOption | null | undefined
    list: (ids: string[]) => SectionSourceDataType[] | FeatureOption[] | null
    schema:
      | typeof FeatureProficiencyInputSchema
      | typeof FeatureExpertiseInputSchema
      | typeof FeatureModifierInputSchema
      | typeof FeatureSenseInputSchema
      | typeof FeatureSpellInputSchema
      | typeof FeatureOptionInputSchema
      | typeof FeatureFeatInputSchema
    setCurrent: () => void
  }

  const sectionTypeMap = useCallback(
    (
      step: (typeof SECTION_STEPS)[number] | 'options',
      object?: SectionFormDataType | FeatureOptionInput | null
    ): SectionTypeMapEntry => {
      switch (step) {
        case 'proficiencies': {
          return {
            get: (id: string) => featureProficiencies.findFeatureProficiency(id),
            list: (ids: string[]) => featureProficiencies.findFeatureProficiencies(ids),
            schema: FeatureProficiencyInputSchema,
            setCurrent: () => proficiencyStore.setCurrent(object as FeatureProficiencyInput),
          }
          break
        }
        case 'expertise': {
          return {
            get: (id: string) => featureExpertise.findFeatureExpertise(id),
            list: (ids: string[]) => featureExpertise.findFeatureExpertises(ids),
            schema: FeatureExpertiseInputSchema,
            setCurrent: () => expertiseStore.setCurrent(object as FeatureExpertiseInput),
          }
          break
        }
        case 'modifiers': {
          return {
            get: (id: string) => featureModifiers.findFeatureModifier(id),
            list: (ids: string[]) => featureModifiers.findFeatureModifiers(ids),
            schema: FeatureModifierInputSchema,
            setCurrent: () => modifierStore.setCurrent(object as FeatureModifierInput),
          }
          break
        }
        case 'senses': {
          return {
            get: (id: string) => featureSenses.findFeatureSense(id),
            list: (ids: string[]) => featureSenses.findFeatureSenses(ids),
            schema: FeatureSenseInputSchema,
            setCurrent: () => senseStore.setCurrent(object as FeatureSenseInput),
          }
          break
        }
        case 'spells': {
          return {
            get: (id: string) => featureSpells.findFeatureSpell(id),
            list: (ids: string[]) => featureSpells.findFeatureSpells(ids),
            schema: FeatureSpellInputSchema,
            setCurrent: () => spellStore.setCurrent(object as FeatureSpellInput),
          }
        }
        case 'options': {
          return {
            get: (id: string) => featureOptions.findFeatureOption(id),
            list: (ids: string[]) => featureOptions.findFeatureOptions(ids),
            schema: FeatureOptionInputSchema,
            setCurrent: () => optionStore.setCurrent(object as FeatureOptionInput),
          }
        }
        case 'feats': {
          return {
            get: (id: string) => featureFeats.findFeatureFeat(id),
            list: (ids: string[]) => featureFeats.findFeatureFeats(ids),
            schema: FeatureFeatInputSchema,
            setCurrent: () => featStore.setCurrent(object as FeatureFeatInput),
          }
        }
      }
    },
    [
      featureExpertise,
      featureModifiers,
      featureProficiencies,
      featureSenses,
      featureSpells,
      featureOptions,
      optionStore,
      proficiencyStore,
      senseStore,
      spellStore,
      expertiseStore,
      modifierStore,
      featStore,
      featureFeats,
    ]
  )

  const { createFeatures } = useGetFeatures()

  const getStateSections = useCallback(
    ({
      data,
    }: {
      data: {
        modifiers?: CharacterModifierInput[] | null
        expertise?: CharacterExpertiseInput[] | null
        proficiencies?: CharacterProficiencyInput[] | null
        senses?: CharacterSenseInput[] | null
        feats?: CharacterFeatInput[] | null
        spellcasting?: CharacterSpellcastingInput | null
        features?: CharacterFeatureInput[] | null
      }
    }): StateSections => {
      const existing: StateSections = {}
      SECTION_STEPS.filter((sectionStep) => sectionStep !== 'spells').forEach((sectionStep) => {
        existing[sectionStep] = []

        const sections = data[sectionStep]
        if (!sections) return
        sections?.forEach((section, index) => {
          let fullSections: SectionFormDataType[] = []
          let fullFeature = {} as FeatureFormDataType
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

          if (!section.id) return

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

          existing[sectionStep].push(existingSection)

          if (classId) {
            const fullClass = classes?.findClass(classId)

            if (!featureId && sectionStep === 'proficiencies' && fullClass?.proficiencies?.length) {
              fullSections = fullClass?.proficiencies.map((proficiency) =>
                FeatureProficiencyInputSchema.parse(proficiency)
              )
            } else {
              if (featureId && fullClass?.features?.includes(featureId)) {
                const classFeature = featureData.findFeature(featureId)
                if (classFeature) {
                  fullFeature = FeatureInputSchema.parse(classFeature)
                }
              }
            }
          }
          if (raceId) {
            const fullRace = races?.findRace(raceId)

            if (ancestryId) {
              const fullAncestry = ancestryOptions.findAncestryOption(ancestryId)

              if (fullAncestry) {
                if (featureId && fullAncestry?.features?.includes(featureId)) {
                  const ancestryFeature = featureData.findFeature(featureId)
                  if (ancestryFeature) {
                    fullFeature = FeatureInputSchema.parse(ancestryFeature)
                  }
                }
              }
            } else {
              if (featureId && fullRace?.features?.includes(featureId)) {
                const raceFeature = featureData.findFeature(featureId)
                if (raceFeature) {
                  fullFeature = FeatureInputSchema.parse(raceFeature)
                }
              }
            }
          }
          if (featId) {
            const fullFeat = feats?.findFeat(featId)

            if (featureId && fullFeat?.features?.includes(featureId)) {
              const featFeature = featureData.findFeature(featureId)
              if (featFeature) {
                fullFeature = FeatureInputSchema.parse(featFeature)
              }
            }
          }
          if (backgroundId) {
            const fullBackground = backgrounds?.findBackground(backgroundId)

            if (featureId && fullBackground?.features?.includes(featureId)) {
              const backgroundFeature = featureData.findFeature(featureId)
              if (backgroundFeature) {
                fullFeature = FeatureInputSchema.parse(backgroundFeature)
              }
            }
          }
          if (equipmentId) {
            const fullEquipment = equipment?.findEquipment(equipmentId)

            if (featureId && fullEquipment?.features?.includes(featureId)) {
              const equipmentFeature = featureData.findFeature(featureId)
              if (equipmentFeature) {
                fullFeature = FeatureInputSchema.parse(equipmentFeature)
              }
            }
          }

          if (fullFeature.__kind === 'FeatureInput' && fullFeature?.options?.length) {
            const optionId = data?.features
              ?.find((f) => f.id === fullFeature?.id)
              ?.options?.find((o) => o.optionIndex === optionIndex)?.id

            const sectionIds = featureOptions.findFeatureOption(optionId)?.[sectionStep]

            if (sectionIds?.length) {
              const sections = sectionTypeMap(sectionStep)
                ?.list(sectionIds)
                ?.map((section) => sectionTypeMap(sectionStep)?.schema.parse(section))

              if (sections?.length) {
                fullSections = sections as SectionFormDataType[]
              }
            }
          }

          fullSections?.forEach((fullSection, sIndex) => {
            if (fullSection.__kind === 'FeatureProficiencyInput' || fullSection.__kind === 'FeatureExpertiseInput') {
              let categorySection: FeatureProficiencyInput | FeatureExpertiseInput | undefined | null
              fullFeature?.[sectionStep as 'proficiencies' | 'expertise']?.forEach((step) => {
                if (section.__kind === 'CharacterProficiencyInput' && step === section.id) {
                  const proficiency = featureProficiencies.findFeatureProficiency(step)
                  categorySection = FeatureProficiencyInputSchema.parse(proficiency)
                }
                if (section.__kind === 'CharacterExpertiseInput' && step === section.id) {
                  const expertise = featureExpertise.findFeatureExpertise(step)
                  categorySection = FeatureExpertiseInputSchema.parse(expertise)
                }
              })

              const categoryId = categorySection?.category

              if (!categoryId) return

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
                if (section.id) {
                  if (fullSection.id === section.id) {
                    existing[sectionStep].push({ index: sIndex, id: fullSection.id })
                  }
                }
              }
            }
          })
        })
      })

      return existing
    },
    [
      classes,
      equipment,
      feats,
      backgrounds,
      races,
      featureData,
      featureExpertise,
      featureProficiencies,
      featureOptions,
      sectionTypeMap,
      ancestryOptions,
    ]
  )

  // Private helper functions
  const optionHandlers = useMemo((): OptionHandler => {
    let options: Array<{ id: string; label: string; [x: string]: unknown }> = []
    return {
      proficiencies: {
        canHandle: (section, sectionStep) =>
          section.__kind === 'FeatureProficiencyInput' && sectionStep === 'proficiencies',
        getOptions: (section) => {
          if (section.__kind !== 'FeatureProficiencyInput')
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
        canHandle: (section, sectionStep) => section.__kind === 'FeatureExpertiseInput' && sectionStep === 'expertise',
        getOptions: (section) => {
          if (section.__kind !== 'FeatureExpertiseInput')
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
        canHandle: (section, sectionStep) => section.__kind === 'FeatureModifierInput' && sectionStep === 'modifiers',
        getOptions: (section) => {
          const returnObject = {
            options: [],
            label: '',
          }
          if (section.__kind !== 'FeatureModifierInput') return returnObject
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
            propertyName !== 'spells' &&
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
        canHandle: (section, sectionStep) => section.__kind === 'FeatureFeatInput' && sectionStep === 'feats',
        getOptions: (section) => {
          if (section.__kind !== 'FeatureFeatInput') return { options: [], label: '' }
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
        canHandle: (section, sectionStep) => section.__kind === 'FeatureSenseInput' && sectionStep === 'senses',
        getOptions: (section) => {
          if (section.__kind !== 'FeatureSenseInput') return { options: [], label: '' }
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
        canHandle: (section, sectionStep) => section.__kind === 'FeatureSpellInput' && sectionStep === 'spells',
        getOptions: (section) => {
          if (section.__kind !== 'FeatureSpellInput') return { options: [], label: '' }
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
    data,
    section,
    sectionStep,
    optionIndex,
  }: GetSectionOptionsProps): GetSectionOptionsResult => {
    const existing = getStateSections({ data })
    let options: Array<{ id: string; label: string }> = []
    let label = ''
    let path: DeepKeys<typeof data>
    let exist: string | undefined

    const stateIndex = data[sectionStep as Exclude<typeof sectionStep, 'spells'>]?.length || 0

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
      const stateIndex = data?.spellcasting?.additional?.length || 0

      path = `spellcasting.additional[${stateIndex}]`

      exist = data?.spellcasting?.additional?.find((spell) => spell.optionIndex === optionIndex)?.id

      if (exist != null) {
        const existIndex = data?.spellcasting?.additional?.findIndex((section) => section.optionIndex === optionIndex)

        if (existIndex && existIndex > -1) {
          path = `spellcasting.additional[${existIndex}]`
        }
      }
    } else {
      const existOption = existing[sectionStep].find((existObj) => existObj.optionIndex === optionIndex)

      path = `${sectionStep}[${stateIndex}]`

      if (existOption && existOption?.index > -1) {
        path = `${sectionStep}[${existOption.index}]`
        exist = existOption.id
      }
    }

    return { options, path, label, exist }
  }

  const createSections = useCallback(
    ({
      data,
    }: {
      data: CharacterInput
    }): {
      feats: CharacterFeatInput[]
      modifiers: CharacterModifierInput[]
      proficiencies: CharacterProficiencyInput[]
      expertise: CharacterExpertiseInput[]
      senses: CharacterSenseInput[]
    } => {
      // Initialize with existing data and validate against current data// Common validation function for all section types
      const isValidSection = (
        section:
          | CharacterExpertiseInput
          | CharacterFeatInput
          | CharacterSenseInput
          | CharacterProficiencyInput
          | CharacterModifierInput
      ) => {
        const sourceValid =
          (section.classId && data?.classes?.some((c) => c && c.id === section.classId)) ||
          (section.raceId && section.raceId === data.race) ||
          (section.ancestryId && section.ancestryId === data.ancestry?.id) ||
          (section.backgroundId && section.backgroundId === data?.background)

        const optionValid =
          !section.optionId ||
          data?.features?.find((f) => f.id === section.featureId)?.options?.some((o) => o.id === section.optionId)

        return sourceValid && optionValid
      }

      // Create sections object with explicit typing
      const sections = {
        feats: [...(data.feats || [])].filter(isValidSection) as CharacterFeatInput[],
        modifiers: [...(data.modifiers || [])].filter(isValidSection) as CharacterModifierInput[],
        proficiencies: [...(data.proficiencies || [])].filter(isValidSection) as CharacterProficiencyInput[],
        expertise: [...(data.expertise || [])].filter(isValidSection) as CharacterExpertiseInput[],
        senses: [...(data.senses || [])].filter(isValidSection) as CharacterSenseInput[],
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
          return obj.__kind === kind(section, '__kind')
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
      const pushSections = (fullFeature: FeatureFormDataType, feature: FactoryFeature) => {
        // For each valid section type
        const featureObject = CharacterFeatureInputSchema.parse({
          ...feature,
        }) as FactoryFeature & { __kind: 'CharacterFeatureInput' }
        SECTION_STEPS.filter((step) => step !== 'spells').forEach((sectionStep) => {
          if (fullFeature?.[sectionStep]?.length) {
            fullFeature[sectionStep].forEach((fSection) => {
              const sectionData = sectionTypeMap(sectionStep).get(fSection)
              const sectionInput = sectionTypeMap(sectionStep).schema.parse(sectionData)
              if (!sectionInput?.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS)) {
                // Special handling for proficiencies and expertise
                if (
                  (sectionInput?.__kind === 'FeatureProficiencyInput' ||
                    sectionInput?.__kind === 'FeatureExpertiseInput') &&
                  sectionInput.category
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
        fullFeature: FeatureFormDataType,
        feature: CharacterFeatureInput
      ): (typeof sections)[T][number] {
        // Use the specific return type based on the section type
        const typeName = kind(sectionStep, '__kind')

        // Create the base object with the required type
        const sectionObject = characterSectionSchemas.parse({
          __kind: typeName,
          id: fSection.id,
          featureId: fullFeature.id,
        })

        // Add source IDs
        sectionIds.forEach((sourceKey) => {
          if (feature?.[sourceKey]) sectionObject[sourceKey] = feature[sourceKey]
        })

        return sectionObject as (typeof sections)[typeof sectionStep][number]
      }

      const features = createFeatures({ data })

      features?.forEach((feature) => {
        const fullFeature = featureData.findFeature(feature.id)
        if (fullFeature) {
          pushSections(FeatureInputSchema.parse(fullFeature), feature)
        }

        if (feature?.options?.length) {
          feature?.options?.forEach((option) => {
            const optionData = featureOptions.findFeatureOption(option.id)

            if (optionData) {
              const optionInput = FeatureOptionInputSchema.parse(optionData)
              pushSections(optionInput, feature)
            }
          })
        }
      })

      data?.classes?.forEach((fClass) => {
        if (!fClass) return
        const fullClass = classes?.findClass(fClass.id)

        const proficiencies = fullClass?.proficiencies || []

        proficiencies?.forEach((proficiency) => {
          const exist = sections.proficiencies.find((s) => s.classId === fClass.id && s.id === proficiency.id)

          if (exist) return

          const sectionObject = CharacterProficiencyInputSchema.parse({
            classId: fClass.id,
            id: proficiency.id,
          })
          pushToSection('proficiencies', sectionObject)
        })
      })

      return sections
    },
    [classes, featureData, featureOptions, sectionTypeMap, createFeatures]
  )

  const createAbilityScores = useCallback(
    ({ data }: { data: CharacterInput }): ScoresInput[] | undefined => {
      const abilityScores: ScoresInput[] =
        JSON.parse(JSON.stringify(data?.abilities?.scores)) || ([] as NonNullable<Character['abilities']>['scores'])

      const characterModifiers = [...(data?.modifiers || [])]

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
              const feature = featureData.findFeature(cModifier.featureId)
              const foundMod = featureModifiers.findFeatureModifier(cModifier.id)
              if (foundMod && feature?.modifiers?.includes(foundMod.id) && foundClass.features?.includes(feature.id)) {
                featureMod = foundMod
              }
            }
          }
          if (cModifier.raceId) {
            const foundRace = races.findRace(cModifier.raceId)
            if (foundRace) {
              const feature = featureData.findFeature(cModifier.featureId)
              const foundMod = featureModifiers.findFeatureModifier(cModifier.id)
              if (foundMod && feature?.modifiers?.includes(foundMod.id) && foundRace.features?.includes(feature.id)) {
                featureMod = foundMod
              }
              if (cModifier.ancestryId) {
                const foundAncestry = ancestryOptions.findAncestryOption(cModifier.ancestryId)
                if (foundAncestry) {
                  const ancestryFeature = featureData.findFeature(cModifier.featureId)
                  const foundMod = featureModifiers.findFeatureModifier(cModifier.id)
                  if (
                    foundMod &&
                    ancestryFeature?.modifiers?.includes(foundMod.id) &&
                    foundAncestry.features?.includes(ancestryFeature.id)
                  ) {
                    featureMod = foundMod
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
          abilityScores[index] = ScoresInputSchema.parse({
            ...score,
            calculatedScore: calculatedScore,
            raceScore: raceScore,
            classScore: classScore,
            modifierScore: modifierScore,
          })
        }
      })

      return abilityScores
    },
    [classes, races, featureData, featureModifiers, ancestryOptions]
  )

  return {
    getSectionOptions,
    createSections,
    createAbilityScores,
    sectionTypeMap,
  }
}
export default useGetSections
