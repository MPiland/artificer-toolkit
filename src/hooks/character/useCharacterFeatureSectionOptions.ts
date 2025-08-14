import type {
  CharacterInput,
  CharacterSpellInput,
  SectionFormDataType,
  FeatureModifierInput,
  FeatureExpertiseInput,
  FeatureProficiencyInput,
  FeatureSenseInput,
  FeatureFeatInput,
  FeatureSpellInput,
} from '~/types'
import { getKeyFromId, SECTION_STEPS } from '~/components/Form'
import { useListEquipment, useListFeats, useListSpells } from '~/apis'
import { useSystemData } from '~/hooks'
import { useTypedFormStore } from '~/store'
import { useShallow } from 'zustand/react/shallow'
import type { DeepKeys } from '@tanstack/react-form'
import { Attributes, ModCats, ModSpellCats, ProfCats } from '~/enums'
import { useCharacterSectionData } from '~/hooks'
import { getModifierProperties } from '~/utils'

type SectionPath<T> =
  T extends FeatureModifierInput ? `modifiers${DeepKeys<NonNullable<CharacterInput['modifiers']>>}`
  : T extends FeatureExpertiseInput ? `expertise${DeepKeys<NonNullable<CharacterInput['expertise']>>}`
  : T extends FeatureProficiencyInput ? `proficiencies${DeepKeys<NonNullable<CharacterInput['proficiencies']>>}`
  : T extends FeatureSenseInput ? `senses${DeepKeys<NonNullable<CharacterInput['senses']>>}`
  : T extends FeatureFeatInput ? `feats${DeepKeys<NonNullable<CharacterInput['feats']>>}`
  : T extends FeatureSpellInput ? `spellcasting.additional${DeepKeys<NonNullable<CharacterSpellInput[]>>}`
  : never

// Grouped by domain
// Option-related functions
export const useCharacterFeatureSectionOptions = <T extends SectionFormDataType>({
  section,
  sectionStep,
  optionIndex,
}: {
  section: T
  sectionStep: (typeof SECTION_STEPS)[number]
  optionIndex: string
}): { options: { id: string; label: string }[]; label: string; path: SectionPath<T>; exist: string | undefined } => {
  const { system } = useSystemData()
  const {
    data: { equipment, metaData: equipmentMeta },
  } = useListEquipment()
  const {
    data: { feats },
  } = useListFeats()
  const {
    data: { spells, metaData: spellMeta },
  } = useListSpells()

  // Helper functions for option processing
  const processAllOrSpecificIds = <T extends { id: string; label: string }>(
    items: T[],
    ids: string[] | undefined | null,
    filterFn?: (item: T) => boolean
  ): T[] => {
    const hasAll = ids?.some((id) => id === 'all')
    if (hasAll) {
      return filterFn ? items.filter(filterFn) : items
    }
    return items.filter((item) => ids?.includes(item.id))
  }

  const processEquipmentOptions = (
    type: 'equipment' | 'properties',
    data: { ids?: string[]; properties?: string[]; category?: string }
  ): Array<{ id: string; label: string }> => {
    if (!data || (!data.ids && !data.properties)) {
      return []
    }

    const { properties, ids, category: equipmentCategory } = data

    if (type === 'equipment') {
      return processEquipmentItems({
        ids,
        properties,
        equipmentCategory,
      })
    } else {
      // Handle properties type
      return processAllOrSpecificIds(system.equipment.properties, ids)
    }
  }

  const processEquipmentItems = ({
    ids,
    properties,
    equipmentCategory,
  }: {
    ids?: string[]
    properties?: string[]
    equipmentCategory?: string
  }): Array<{ id: string; label: string }> => {
    // If specific equipment IDs are provided (not 'all'), return those
    if (ids && !ids.includes('all')) {
      return equipment.filter((equipment) => ids.includes(equipment.id))
    }

    // Handle 'all' case with filtering
    if (ids?.includes('all')) {
      return filterEquipmentByCategory({
        equipmentCategory,
        properties,
      })
    }

    return []
  }

  const filterEquipmentByCategory = ({
    equipmentCategory,
    properties,
  }: {
    equipmentCategory?: string
    properties?: string[]
  }): Array<{ id: string; label: string }> => {
    // Filter by equipment category
    const categoryFilteredEquipment =
      equipmentCategory ?
        equipment.filter((equipment) => {
          const category = equipmentMeta.categories?.find((c) => c.id === equipmentCategory)
          return category?.equipmentIds?.includes(equipment.id)
        })
      : equipment

    // If no properties filter, return category-filtered equipment
    if (!properties?.length) {
      return categoryFilteredEquipment
    }

    // Apply properties filter
    return categoryFilteredEquipment.filter((equipment) => {
      return equipmentMeta.properties?.some((property) => {
        return properties.includes(property.id) && property.equipmentIds?.includes(equipment.id)
      })
    })
  }

  const processProficiencyOptions = (
    categoryId: string
  ): { options: { id: string; label: string }[]; label: string } => {
    if (section.__kind !== 'FeatureExpertiseInput' && section.__kind !== 'FeatureProficiencyInput') {
      return {
        options: [],
        label: '',
      }
    }

    let options: { id: string; label: string }[] = []

    // Handle each category type based on the categoryId
    switch (categoryId) {
      case ProfCats.EQUIPMENT: {
        if (section.equipment) {
          // Convert InputMaybe types to expected types
          const equipmentData = {
            ids: section.equipment.ids || undefined,
            properties: section.equipment.properties || undefined,
            category: section.equipment.category || undefined,
          }
          options = processEquipmentOptions('equipment', equipmentData)
        }
        break
      }
      case ProfCats.PROPERTIES: {
        if (section.properties) {
          // Convert InputMaybe types to expected types
          const propertiesData = {
            ids: section.properties.ids || undefined,
            properties: section.properties.properties || undefined,
            category: section.properties.category || undefined,
          }
          options = processEquipmentOptions('properties', propertiesData)
        }
        break
      }
      case ProfCats.SAVE_ABILITIES: {
        options = processAllOrSpecificIds(system.abilities, section.saveAbilities || [])
        break
      }
      case ProfCats.SKILLS: {
        options = processAllOrSpecificIds(system.skills, section.skills || [])
        break
      }
      case ProfCats.LANGUAGES: {
        options = processAllOrSpecificIds(system.languages, section.languages || [])
        break
      }
      case ProfCats.INITIATIVE: {
        // Initiative doesn't have options to select
        options = []
        break
      }
      default: {
        // Fallback for any unknown categories
        options = []
        break
      }
    }

    return {
      options,
      label: system.proficiencies.categories.find((sCategory) => sCategory.id === categoryId)?.label || '',
    }
  }

  const store = useTypedFormStore<CharacterInput>()

  // Use shallow comparison for better performance
  const sectionData = store(
    useShallow((state) =>
      sectionStep === 'spells' ? state.current?.spellcasting?.additional : state.current?.[sectionStep]
    )
  )

  const { data: existing } = useCharacterSectionData({ data: sectionData || [] })
  let options: { id: string; label: string }[] = []
  let label = ''
  let path: SectionPath<typeof sectionData>
  let exist: string | undefined

  const stateIndex = Array.isArray(sectionData) ? sectionData.length : 0

  // Handle different section types with type-safe switch statement
  switch (sectionStep) {
    case 'proficiencies': {
      if (section.__kind === 'FeatureProficiencyInput') {
        const categoryId = section.category
        const result = processProficiencyOptions(categoryId)
        options = result.options
        label = result.label
      }
      break
    }
    case 'expertise': {
      if (section.__kind === 'FeatureExpertiseInput') {
        const categoryId = section.category
        const result = processProficiencyOptions(categoryId)
        options = result.options
        label = result.label
      }
      break
    }
    case 'modifiers': {
      if (section.__kind === 'FeatureModifierInput') {
        const categoryId = section.category
        if (categoryId) {
          const categoryName = getKeyFromId(categoryId, { ...ModCats, ...ModSpellCats })
          const propertyName = getModifierProperties({ category: categoryName })
          if (propertyName) {
            const property = section[propertyName]
            let modifierOptions: Array<{ id: string; label: string }> = []

            // Focus on array properties that provide options
            if (
              propertyName !== 'spells' &&
              propertyName !== 'range' &&
              propertyName !== 'shape' &&
              propertyName !== 'duration' &&
              Array.isArray(property)
            ) {
              if (propertyName === 'saveAbilities') {
                modifierOptions = processAllOrSpecificIds(system.abilities, property)
              } else {
                modifierOptions = processAllOrSpecificIds(system[propertyName] || [], property)
              }
            }

            options = modifierOptions
            label = system.modifiers.categories.find((sCategory) => sCategory.id === categoryId)?.label || ''
          }
        }
      }
      break
    }
    case 'feats': {
      if (section.__kind === 'FeatureFeatInput') {
        options = processAllOrSpecificIds(feats, section?.feats)
        label = 'Feat'
      }
      break
    }
    case 'senses': {
      if (section.__kind === 'FeatureSenseInput') {
        options = processAllOrSpecificIds(system.senses, section?.ids)
        label = 'Sense'
      }
      break
    }
    case 'spells': {
      if (section.__kind === 'FeatureSpellInput') {
        let spellOptions = processAllOrSpecificIds(spells, section?.ids)

        // Apply class limit filter
        if (section.attributes?.some((attribute) => attribute === Attributes.CLASS_LIMIT)) {
          spellOptions = spellOptions.filter((option) =>
            spellMeta?.classes?.some((c) => c.spellIds?.includes(option.id) && section.classLimit?.includes(c.id))
          )
        }

        // Apply level limit filter
        if (section.attributes?.some((attribute) => attribute === Attributes.LEVEL_LIMIT)) {
          spellOptions = spellOptions.filter((option) =>
            spellMeta?.levels?.some(
              (c) => c.spellIds?.includes(option.id) && section.levelLimit?.includes(String(c.id))
            )
          )
        }

        options = spellOptions
        label = 'Spell'
      }
      break
    }
  }

  if (sectionStep === 'expertise' && sectionData?.every((item) => item.__kind === 'CharacterExpertiseInput')) {
    options = options?.filter((option) => existing?.flatMap((existing) => existing.id).includes(option.id))
  }

  options = options?.filter((option) => {
    const existingSelection = existing?.find((existObj) => existObj.id === option.id)
    return !existingSelection || existingSelection.optionIndex === optionIndex
  })

  if (sectionStep === 'spells' && sectionData?.every((item) => item.__kind === 'CharacterSpellInput')) {
    const stateIndex = sectionData?.length || 0

    path = `spellcasting.additional[${stateIndex}]` as SectionPath<typeof sectionData>

    exist = sectionData?.find((spell) => spell.optionIndex === optionIndex)?.id

    if (exist != null) {
      const existIndex = sectionData?.findIndex((section) => section.optionIndex === optionIndex)

      if (existIndex && existIndex > -1) {
        path = `spellcasting.additional[${existIndex}]` as SectionPath<typeof sectionData>
      }
    }
  } else {
    const existOption = existing?.find((existObj) => existObj.optionIndex === optionIndex)

    path = `${sectionStep === 'spells' ? 'spellcasting.additional' : sectionStep}[${stateIndex}]` as SectionPath<
      typeof sectionData
    >

    if (existOption?.id && existOption?.index > -1) {
      path =
        `${sectionStep === 'spells' ? 'spellcasting.additional' : sectionStep}[${existOption.index}]` as SectionPath<
          typeof sectionData
        >
      exist = existOption.id
    }
  }

  return { options, path, label, exist }
}
