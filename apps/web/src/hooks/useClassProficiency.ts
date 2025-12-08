import { Class, type System } from '~types'
import { useSystemData } from '~hooks'
import { ProfCats } from '~enums'
import { useListEquipment } from '~apis'

export type ClassProficiencyOption = {
  type: { id: string; label: string }[]
  property?: System['equipment']['properties']
  selectionCount: number | null
  id: string
}

export type ClassProficiencyOptions = {
  [key: string]: ClassProficiencyOption
}

type ProficiencyItem = { id: string; label: string }

const useClassProficiency = ({ fullClass }: { fullClass: Class }) => {
  const { system } = useSystemData()
  const {
    data: { equipment, metaData },
  } = useListEquipment()
  const fullProficiencies = fullClass?.proficiencies
  const proficiencyObject = {} as ClassProficiencyOptions

  // Helper function to get existing types for a category
  const getExistingTypes = (categoryKey: string): ProficiencyItem[] => {
    return [...(proficiencyObject[categoryKey]?.type || [])]
  }

  // Helper function to filter out duplicates and map to ProficiencyItem
  const filterAndMap = <T extends { id: string; label: string }>(
    items: T[],
    existingTypes: ProficiencyItem[]
  ): ProficiencyItem[] => {
    return items
      .filter((item) => !existingTypes.some((type) => type.id === item.id))
      .map((item) => ({ id: item.id, label: item.label }))
  }

  // Helper function to process 'all' vs specific IDs
  const processItemSelection = <T extends { id: string; label: string }>(
    items: T[],
    ids: string[] | null | undefined,
    existingTypes: ProficiencyItem[],
    filterFn?: (item: T) => boolean
  ): ProficiencyItem[] => {
    const hasAll = ids?.some((id) => id === 'all')
    let filteredItems = items

    if (hasAll) {
      if (filterFn) {
        filteredItems = items.filter(filterFn)
      }
    } else {
      filteredItems = items.filter((item) => ids?.some((id) => id === item.id))
    }

    return filterAndMap(filteredItems, existingTypes)
  }

  // Helper function to set proficiency object entry
  const setProficiencyEntry = (
    key: string,
    proficiencyId: string,
    existingTypes: ProficiencyItem[],
    newTypes: ProficiencyItem[],
    selectionCount: number | null | undefined
  ) => {
    proficiencyObject[key] = {
      id: proficiencyId,
      type: [...existingTypes, ...newTypes],
      selectionCount: selectionCount || 0,
    }
  }

  fullProficiencies?.forEach((proficiency) => {
    switch (proficiency?.category) {
      case ProfCats.PROPERTIES: {
        if (!proficiency?.properties?.ids?.length) break

        const equipmentCategory = system.equipment.categories.find(
          (category) => category.id === proficiency?.properties?.category
        )
        if (!equipmentCategory) break

        const existingTypes = getExistingTypes(equipmentCategory.label)
        const hasAll = proficiency.properties.ids.some((id) => id === 'all')

        let filteredProperties: ProficiencyItem[]
        if (hasAll) {
          filteredProperties = filterAndMap(
            system.equipment.properties.filter((property) =>
              system.equipment.categoryProperties.some(
                (category) =>
                  category.categoryId === proficiency?.properties?.category && category.propertyId === property.id
              )
            ),
            existingTypes
          )
        } else {
          filteredProperties = filterAndMap(
            system.equipment.properties.filter((property) =>
              proficiency?.properties?.ids?.some((id) => id === property.id)
            ),
            existingTypes
          )
        }

        setProficiencyEntry(
          equipmentCategory.label,
          proficiency.id,
          existingTypes,
          filteredProperties,
          proficiency.selectionCount ?? null
        )
        break
      }

      case ProfCats.EQUIPMENT: {
        const equipmentCategory = system.equipment.categories.find(
          (category) => category.id === proficiency?.equipment?.category
        )
        if (!equipmentCategory) break

        const existingTypes = getExistingTypes(equipmentCategory.label)
        const hasAll = proficiency?.equipment?.ids?.some((id) => id === 'all')
        const hasProperties = proficiency?.equipment?.properties?.length

        let filteredEquipment: ProficiencyItem[]
        if (hasAll) {
          const categoryFilter = (eq: { id: string; label: string }) =>
            metaData.categories?.find((c) => c.id === proficiency?.equipment?.category)?.equipmentIds?.includes(eq.id)

          if (hasProperties) {
            const propertyFilter = (eq: { id: string; label: string }) =>
              metaData.properties?.some((p) =>
                proficiency?.equipment?.properties?.some(
                  (property) => p.id === property && p.equipmentIds?.includes(eq.id)
                )
              )
            filteredEquipment = filterAndMap(
              equipment.filter((eq) => categoryFilter(eq) && propertyFilter(eq)),
              existingTypes
            )
          } else {
            filteredEquipment = filterAndMap(equipment.filter(categoryFilter), existingTypes)
          }
        } else {
          filteredEquipment = filterAndMap(
            equipment.filter((eq) => proficiency?.equipment?.ids?.some((id) => id === eq.id)),
            existingTypes
          )
        }

        setProficiencyEntry(
          equipmentCategory.label,
          proficiency.id,
          existingTypes,
          filteredEquipment,
          proficiency.selectionCount ?? null
        )
        break
      }

      case ProfCats.SKILLS: {
        // Note: Fixed typo 'skils' -> 'skills'
        const existingTypes = getExistingTypes('skills')
        const filteredSkills = processItemSelection(system.skills, proficiency?.skills ?? undefined, existingTypes)

        setProficiencyEntry('skills', proficiency.id, existingTypes, filteredSkills, proficiency.selectionCount ?? null)
        break
      }

      case ProfCats.LANGUAGES: {
        const existingTypes = getExistingTypes('languages')
        const filteredLanguages = processItemSelection(
          system.languages,
          proficiency?.languages ?? undefined,
          existingTypes
        )

        setProficiencyEntry(
          'languages',
          proficiency.id,
          existingTypes,
          filteredLanguages,
          proficiency.selectionCount ?? null
        )
        break
      }

      case ProfCats.SAVE_ABILITIES: {
        const existingTypes = getExistingTypes('saveAbilities')
        const filteredSaveAbilities = processItemSelection(
          system.abilities,
          proficiency?.saveAbilities ?? undefined,
          existingTypes
        )

        setProficiencyEntry(
          'saveAbilities',
          proficiency.id,
          existingTypes,
          filteredSaveAbilities,
          proficiency.selectionCount ?? null
        )
        break
      }
    }
  })

  // Sort proficiencies: items without selectionCount first, then alphabetically
  const sortedProficiencyObject = Object.fromEntries(
    Object.entries(proficiencyObject).sort(([keyA, valueA], [keyB, valueB]) => {
      // If one has selectionCount and the other doesn't, the one with selectionCount goes last
      if (valueA.selectionCount !== valueB.selectionCount) {
        return valueA.selectionCount ? 1 : -1
      }
      // If both have same selectionCount status, sort alphabetically
      return keyA.localeCompare(keyB)
    })
  ) as ClassProficiencyOptions

  return sortedProficiencyObject
}

export default useClassProficiency
