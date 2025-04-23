import { Enum, GQL } from '@/types'
import { useEquipmentData, useSystemData } from '@/hooks'

export type ClassProficiency = {
  [key: string]: {
    type: { id: string; label: string; value: string }[]
    property?: any[]
    selectionCount: number | null
    proficiencyId: string
  }
}

const useGetProficiencies = ({ fullClass }: { fullClass: GQL.Class }) => {
  const { system } = useSystemData()
  const { equipment } = useEquipmentData()

  const fullProficiencies = fullClass?.proficiencies

  const proficiencyObject = {} as ClassProficiency

  fullProficiencies?.forEach((proficiency) => {
    if (proficiency?.category === Enum.ProficiencyCategories.properties) {
      if (proficiency?.properties?.ids?.length) {
        const equipmentCategory = system.equipment.categories.find(
          (category) => category.id === proficiency?.properties?.category
        )
        if (equipmentCategory) {
          const existType: Array<{ id: string; label: string; value: string }> = [
            ...(proficiencyObject[equipmentCategory.value]?.type || []),
          ]

          const filteredProperties = []

          if (proficiency?.properties.ids.some((id) => id === 'all')) {
            filteredProperties.push(
              ...system.equipment.properties
                .filter((property) =>
                  system.equipment.categoryProperties.some(
                    (category) =>
                      category.categoryId === proficiency?.properties?.category && category.propertyId === property.id
                  )
                )
                .filter((property) => !existType.some((type) => type.id === property.id))
                .map((property) => ({ id: property.id, label: property.label, value: property.value }))
            )
          } else {
            filteredProperties.push(
              ...system.equipment.properties
                .filter((property) => proficiency?.properties?.ids?.some((id) => id === property.id))
                .filter((property) => !existType.some((type) => type.id === property.id))
                .map((property) => ({ id: property.id, label: property.label, value: property.value }))
            )
          }

          proficiencyObject[equipmentCategory.value] = {
            proficiencyId: proficiency.id,
            type: [...existType, ...filteredProperties],
            selectionCount: proficiency?.selectionCount || 0,
          }
        }
      }
    }
    if (proficiency?.category === Enum.ProficiencyCategories.equipment) {
      const equipmentCategory = system.equipment.categories.find(
        (category) => category.id === proficiency?.equipment?.category
      )

      if (equipmentCategory) {
        const existType: Array<{ id: string; label: string; value: string }> = [
          ...(proficiencyObject[equipmentCategory.value]?.type || []),
        ]

        const filteredEquipment = []
        if (proficiency?.equipment?.ids?.some((id) => id === 'all')) {
          if (proficiency?.equipment?.properties?.length) {
            filteredEquipment.push(
              ...equipment
                .filterByCategory(proficiency?.equipment?.category)
                .filterByProperties(proficiency?.equipment?.properties)
                .filter((sEquipment) => !existType.some((type) => type.id === sEquipment.id))
                .map((sEquipment) => ({ id: sEquipment.id, label: sEquipment.label, value: sEquipment.value }))
            )
          } else {
            filteredEquipment.push(
              ...equipment
                .filterByCategory(proficiency?.equipment?.category)
                .filter((sEquipment) => !existType.some((type) => type.id === sEquipment.id))
                .map((sEquipment) => ({ id: sEquipment.id, label: sEquipment.label, value: sEquipment.value }))
            )
          }
        } else {
          filteredEquipment.push(
            ...equipment
              .filter((sEquipment) => proficiency?.equipment?.ids?.some((id) => id === sEquipment.id))
              .filter((sEquipment) => !existType.some((type) => type.id === sEquipment.id))
              .map((sEquipment) => ({ id: sEquipment.id, label: sEquipment.label, value: sEquipment.value }))
          )
        }

        proficiencyObject[equipmentCategory.value] = {
          proficiencyId: proficiency.id,
          type: [...existType, ...filteredEquipment],
          selectionCount: proficiency?.selectionCount || 0,
        }
      }
    } else if (proficiency?.category === Enum.ProficiencyCategories.skills) {
      const existType: Array<{ id: string; label: string; value: string }> = [...(proficiencyObject?.skils?.type || [])]

      const filteredSkills = []
      if (proficiency?.skills?.some((skill) => skill === 'all')) {
        filteredSkills.push(
          ...system.skills
            .filter((skill) => !existType.some((type) => type.id === skill.id))
            .map((skill) => ({ id: skill.id, label: skill.label, value: skill.value }))
        )
      } else {
        filteredSkills.push(
          ...system.skills
            .filter((skill) => proficiency?.skills?.some((skillId) => skillId === skill.id))
            .filter((skill) => !existType.some((type) => type.id === skill.id))
            .map((skill) => ({ id: skill.id, label: skill.label, value: skill.value }))
        )
      }

      proficiencyObject.skills = {
        proficiencyId: proficiency.id,
        type: [...existType, ...filteredSkills],
        selectionCount: proficiency?.selectionCount || 0,
      }
    } else if (proficiency?.category === Enum.ProficiencyCategories.languages) {
      const existType: Array<{ id: string; label: string; value: string }> = [
        ...(proficiencyObject?.languages?.type || []),
      ]

      const filteredLanguages = []
      if (proficiency?.languages?.some((language) => language === 'all')) {
        filteredLanguages.push(
          ...system.languages
            .filter((language) => !existType.some((type) => type.id === language.id))
            .map((language) => ({ id: language.id, label: language.label, value: language.value }))
        )
      } else {
        filteredLanguages.push(
          ...system.languages
            .filter((language) => proficiency?.languages?.some((languageId) => languageId === language.id))
            .filter((language) => !existType.some((type) => type.id === language.id))
            .map((language) => ({ id: language.id, label: language.label, value: language.value }))
        )
      }

      proficiencyObject.languages = {
        proficiencyId: proficiency.id,
        type: [...existType, ...filteredLanguages],
        selectionCount: proficiency?.selectionCount || 0,
      }
    } else if (proficiency?.category === Enum.ProficiencyCategories.saveAbilities) {
      const existType: Array<{ id: string; label: string; value: string }> = [
        ...(proficiencyObject?.saveAbilities?.type || []),
      ]

      const filteredSaveAbilities = []
      if (proficiency?.saveAbilities?.some((ability) => ability === 'all')) {
        filteredSaveAbilities.push(
          ...system.abilities
            .filter((ability) => !existType.some((type) => type.id === ability.id))
            .map((ability) => ({ id: ability.id, label: ability.label, value: ability.value }))
        )
      } else {
        filteredSaveAbilities.push(
          ...system.abilities
            .filter((ability) => proficiency?.saveAbilities?.some((abilityId) => abilityId === ability.id))
            .filter((ability) => !existType.some((type) => type.id === ability.id))
            .map((ability) => ({ id: ability.id, label: ability.label, value: ability.value }))
        )
      }

      proficiencyObject.saveAbilities = {
        proficiencyId: proficiency.id,
        type: [...existType, ...filteredSaveAbilities],
        selectionCount: proficiency?.selectionCount || 0,
      }
    }
  })

  const sortedProficiencyObject = Object.fromEntries(
    Object.entries(proficiencyObject).sort(([keyA, valueA], [keyB, valueB]) => {
      // If one has selectionCount and the other doesn't, the one with selectionCount goes last
      if (valueA.selectionCount !== valueB.selectionCount) {
        return valueA.selectionCount ? 1 : -1
      }
      // If both have same selectionCount status, sort alphabetically
      return keyA.localeCompare(keyB)
    })
  ) as ClassProficiency

  return sortedProficiencyObject
}

export default useGetProficiencies
