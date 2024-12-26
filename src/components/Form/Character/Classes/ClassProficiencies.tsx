import { useCallback, useMemo } from 'react'
import Collapse from '../../../Collapse/Collapse'
import Dropdown from '../../../Dropdown/Dropdown'
import { sprinkles } from '../../../../css/sprinkles.css'
import { startCase, uniqBy } from 'lodash'
import { feature_card_header } from '../Character.css'
import { numberToWords } from '../../../../utils/formatting'
import { useListEquipmentQuery } from '../../../../features/equipment/equipmentApi'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { Character, CharacterClass, Class, FeatureProficiency } from '../../../../../amplify/API'
import { UpdateState } from '../../../../types/form'
import { EquipmentCategories, ProficiencyCategories } from '../../../../types/enums'
import useGetSections from '../../../../hooks/useGetSectionState'

export type ClassProficiency = {
  [key: string]: {
    type: any[]
    property?: any[]
    selectionCount: number | null
  }
}

const ClassProficiencies = ({
  fullClass,
  classIndex,
  formData,
  updateFormData,
}: {
  fullClass: Class
  uClass: CharacterClass
  classIndex: number
  formData: Character
  updateFormData: (state: UpdateState<Character>) => void
}) => {
  const { data: system } = useGetSystemQuery()
  const { data: equipment } = useListEquipmentQuery()
  const { getSectionOptions } = useGetSections({ state: formData })

  // Create the proficiencies array
  const createProficiencies = useCallback(() => {
    const sortObjectFields = (obj: ClassProficiency, stateOrder: FeatureProficiency[]) => {
      let sortedKeys: string[] = []
      const sortedObjects: ClassProficiency = {}
      stateOrder.forEach((order) => {
        let categoryName: keyof typeof EquipmentCategories | 'skills' | 'languages' | 'saveAbilities'
        if (order.category === ProficiencyCategories.equipment || order.category === ProficiencyCategories.properties) {
          categoryName = system.equipment.categories.find((sCategory) => sCategory.id === order.equipment.category)
            .value as keyof typeof EquipmentCategories
        }
        if (order.category === ProficiencyCategories.skills) {
          categoryName = 'skills'
        }
        if (order.category === ProficiencyCategories.languages) {
          categoryName = 'languages'
        }
        if (order.category === ProficiencyCategories.saveAbilities) {
          categoryName = 'saveAbilities'
        }
        sortedKeys.push(categoryName)
      })

      sortedKeys = uniqBy(sortedKeys, (key) => key)

      sortedKeys.forEach((key) => {
        sortedObjects[key] = obj[key]
      })

      return sortedObjects
    }

    const fullProficiencies = fullClass.proficiencies

    let proficiencyObject = {} as ClassProficiency

    fullProficiencies?.forEach((proficiency) => {
      if (proficiency.category === ProficiencyCategories.properties) {
        if (proficiency.properties?.ids?.length > 0) {
          const equipmentCategory = system.equipment.categories.find(
            (category) => category.id === proficiency.properties.category
          )

          const existType: Array<{ id: string; label: string; value: string }> = [
            ...(proficiencyObject[equipmentCategory.value].type || []),
          ]

          const filteredProperties = []

          if (proficiency.properties.ids.some((id) => id === 'all')) {
            filteredProperties.push(
              ...system.equipment.properties
                .filter((property) =>
                  system.equipment.categoryProperties.filter(
                    (category) =>
                      category.categoryId === proficiency.properties.category && category.propertyId === property.id
                  )
                )
                .filter((property) => existType.some((type) => type.id === property.id))
                .map((property) => ({ id: property.id, label: property.label, value: property.value }))
            )
          } else {
            filteredProperties.push(
              ...system.equipment.properties
                .filter((property) => proficiency.properties.ids.some((id) => id === property.id))
                .filter((property) => existType.some((type) => type.id === property.id))
                .map((property) => ({ id: property.id, label: property.label, value: property.value }))
            )
          }

          proficiencyObject[equipmentCategory.value] = {
            type: [...proficiencyObject[equipmentCategory.value].type, ...filteredProperties],
            selectionCount: proficiency.selectionCount || 0,
          }
        }
      }
      if (proficiency.category === ProficiencyCategories.equipment) {
        const equipmentCategory = system.equipment.categories.find(
          (category) => category.id === proficiency.equipment.category
        )

        const existType: Array<{ id: string; label: string; value: string }> = [
          ...(proficiencyObject[equipmentCategory.value].type || []),
        ]

        const filteredEquipment = []
        if (proficiency.equipment.ids.some((id) => id === 'all')) {
          if (proficiency.equipment.properties.length > 0) {
            filteredEquipment.push(
              ...equipment
                .filter((sEquipment) => sEquipment.category === proficiency.equipment.category)
                .filter((sEquipment) =>
                  sEquipment.properties.some((eProperty) => proficiency.equipment.properties.includes(eProperty))
                )
                .filter((sEquipment) => existType.some((type) => type.id === sEquipment.id))
                .map((sEquipment) => ({ id: sEquipment.id, label: sEquipment.value, value: sEquipment.value }))
            )
          } else {
            filteredEquipment.push(
              ...equipment
                .filter((sEquipment) => sEquipment.category === proficiency.equipment.category)
                .filter((sEquipment) => existType.some((type) => type.id === sEquipment.id))
                .map((sEquipment) => ({ id: sEquipment.id, label: sEquipment.value, value: sEquipment.value }))
            )
          }
        } else {
          filteredEquipment.push(
            ...equipment
              .filter((sEquipment) => proficiency.equipment.ids.some((id) => id === sEquipment.id))
              .filter((sEquipment) => existType.some((type) => type.id === sEquipment.id))
              .map((sEquipment) => ({ id: sEquipment.id, label: sEquipment.value, value: sEquipment.value }))
          )
        }

        proficiencyObject[equipmentCategory.value] = {
          type: [...proficiencyObject[equipmentCategory.value].type, ...filteredEquipment],
          selectionCount: proficiency.selectionCount || 0,
        }
      } else if (proficiency.category === ProficiencyCategories.skills) {
        const existType: Array<{ id: string; label: string; value: string }> = [...(proficiencyObject.skils.type || [])]

        const filteredSkills = []
        if (proficiency.skills.some((skill) => skill === 'all')) {
          filteredSkills.push(
            ...system.skills
              .filter((skill) => existType.some((type) => type.id === skill.id))
              .map((skill) => ({ id: skill.id, label: skill.label, value: skill.value }))
          )
        } else {
          filteredSkills.push(
            ...system.skills
              .filter((skill) => proficiency.skills.some((skillId) => skillId === skill.id))
              .filter((skill) => existType.some((type) => type.id === skill.id))
              .map((skill) => ({ id: skill.id, label: skill.label, value: skill.value }))
          )
        }

        proficiencyObject.skills = {
          type: [...proficiencyObject.skills.type, ...filteredSkills],
          selectionCount: proficiency.selectionCount || 0,
        }
      } else if (proficiency.category === ProficiencyCategories.languages) {
        const existType: Array<{ id: string; label: string; value: string }> = [
          ...(proficiencyObject.languages.type || []),
        ]

        const filteredLanguages = []
        if (proficiency.languages.some((language) => language === 'all')) {
          filteredLanguages.push(
            ...system.languages
              .filter((language) => existType.some((type) => type.id === language.id))
              .map((language) => ({ id: language.id, label: language.label, value: language.value }))
          )
        } else {
          filteredLanguages.push(
            ...system.languages
              .filter((language) => proficiency.languages.some((languageId) => languageId === language.id))
              .filter((language) => existType.some((type) => type.id === language.id))
              .map((language) => ({ id: language.id, label: language.label, value: language.value }))
          )
        }

        proficiencyObject.languages = {
          type: [...proficiencyObject.skills.type, ...filteredLanguages],
          selectionCount: proficiency.selectionCount || 0,
        }
      } else if (proficiency.category === ProficiencyCategories.saveAbilities) {
        const existType: Array<{ id: string; label: string; value: string }> = [
          ...(proficiencyObject.saveAbilities.type || []),
        ]

        const filteredSaveAbilities = []
        if (proficiency.saveAbilities.some((ability) => ability === 'all')) {
          filteredSaveAbilities.push(
            ...system.abilities
              .filter((ability) => existType.some((type) => type.id === ability.id))
              .map((ability) => ({ id: ability.id, label: ability.label, value: ability.value }))
          )
        } else {
          filteredSaveAbilities.push(
            ...system.abilities
              .filter((ability) => proficiency.saveAbilities.some((abilityId) => abilityId === ability.id))
              .filter((ability) => existType.some((type) => type.id === ability.id))
              .map((ability) => ({ id: ability.id, label: ability.label, value: ability.value }))
          )
        }

        proficiencyObject.languages = {
          type: [...proficiencyObject.skills.type, ...filteredSaveAbilities],
          selectionCount: proficiency.selectionCount || 0,
        }
      }
    })

    proficiencyObject = sortObjectFields(proficiencyObject, fullProficiencies)

    return proficiencyObject
  }, [
    fullClass,
    equipment,
    system.equipment.categories,
    system.equipment.properties,
    system.abilities,
    system.equipment.categoryProperties,
    system.languages,
    system.skills,
  ])

  // Memoize the proficiency array
  const proficiencies = useMemo(() => createProficiencies(), [createProficiencies])

  return (
    <Collapse>
      <Collapse.Header title='Proficiencies' className={feature_card_header} />
      <Collapse.Body>
        {proficiencies &&
          Object.keys(proficiencies).map((key: string, pIndex: number) => {
            const typeArray = proficiencies[key]?.type
            const selectionCount = proficiencies[key]?.selectionCount
            const propertyArray = proficiencies[key]?.property ?? []

            const fullProficiency = fullClass.proficiencies.find((proficiency) => {
              const category = proficiency.category
              const categoryName = system.proficiencies.categories.find((sCategory) => sCategory.id === category).value

              if (proficiency[categoryName as 'properties' | 'equipment']?.category) {
                const proficiencyCategoryName = system.proficiencies.categories.find(
                  (sCategory) => sCategory.id === proficiency[categoryName as 'properties' | 'equipment']?.category
                ).value
                return key === proficiencyCategoryName
              } else {
                return key === categoryName
              }
            })

            const dropdowns = () =>
              Array.from({ length: selectionCount ?? 0 }, (_, index) => {
                const optionIndex = index & pIndex & classIndex

                const { options, path, exist } = getSectionOptions({
                  section: fullProficiency,
                  sectionStep: 'proficiencies',
                  optionIndex,
                })

                // Render the Dropdown component inside the loop
                return (
                  <Dropdown
                    key={index}
                    name={path}
                    className={sprinkles({
                      mx: 'space-15',
                      width: 'size-auto',
                    })}
                    label={`${startCase(key)} Option`}
                    options={options}
                    onChange={updateFormData}
                    value={exist}
                  />
                )
              })

            let typeText: string = ''

            if (propertyArray.length > 0) {
              if (selectionCount != null) {
                typeText = `Choose ${numberToWords(selectionCount)} from `
              }
              propertyArray.forEach((iProperty, pIndex) => {
                if (selectionCount != null) {
                  typeText += `${iProperty.value}s`
                }

                if (propertyArray.length > 1 && propertyArray.length < 3) {
                  if (pIndex !== propertyArray.length - 1) {
                    if (selectionCount != null) {
                      typeText += ' or '
                    } else {
                      typeText += ', '
                    }
                  }
                }
                if (propertyArray.length > 2) {
                  if (pIndex !== propertyArray?.length - 2) {
                    typeText += ', '
                  } else {
                    if (selectionCount != null) {
                      typeText += ' or '
                    } else {
                      typeText += ' and '
                    }
                  }
                }
              })
            } else {
              if (typeArray?.some((type) => type.name === 'all')) {
                if (selectionCount != null) {
                  typeText = `Choose any ${numberToWords(selectionCount)}`
                }
              } else {
                if (selectionCount != null) {
                  typeText = `Choose ${numberToWords(selectionCount)} from `
                }
                typeArray?.map((type, tIndex) => {
                  typeText += `${type.value}`

                  if (typeArray.length > 1 && typeArray.length < 3) {
                    if (tIndex !== typeArray.length - 1) {
                      if (selectionCount != null) {
                        typeText += ' or '
                      } else {
                        typeText += ', '
                      }
                    }
                  }
                  if (typeArray.length > 2) {
                    if (tIndex !== typeArray?.length - 1) {
                      typeText += ', '
                    }
                    if (tIndex == typeArray?.length - 2) {
                      if (selectionCount != null) {
                        typeText += ' or '
                      } else {
                        typeText += ' and '
                      }
                    }
                  }
                })
              }
            }

            return (
              <div key={key}>
                <strong>{`${startCase(key)}: `}</strong>
                {typeText}
                {selectionCount != null && dropdowns()}
              </div>
            )
          })}
      </Collapse.Body>
    </Collapse>
  )
}

export default ClassProficiencies
