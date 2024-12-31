import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Spinner from '../../components/Spinner/Spinner'
import Collapse from '../../components/Collapse/Collapse'
import { feature_header } from './ClassShort.css'
import { useCallback, useMemo } from 'react'
import { startCase, uniqBy } from 'lodash'
import { numberToWords } from '../../utils/formatting'
import { useListEquipmentQuery } from '../equipment/equipmentApi'
import { ClassProficiency } from '../../components/Form/Character/Classes/ClassProficiencies'
import { Class, Feature, FeatureProficiency } from '../../../amplify/API'
import { EquipmentCategories, ProficiencyCategories } from '../../types/enums'
import { useGetSystemQuery } from '../systems/systemsApi'
import { FeatureObject } from '../../components/Form/Character/Classes/ClassFeatures'
import { useListClassesQuery } from './classesApi'
import { excludeFields } from '../../utils/form'

const ClassShort = () => {
  const location: any = useLocation()

  const { data: equipment } = useListEquipmentQuery()
  const { data: system } = useGetSystemQuery()
  const { data: classes } = useListClassesQuery()

  const fullClass: Class = location.state.item

  // Create feauture array for the selected class
  const createFeatures = useCallback(() => {
    let subclassMapped: boolean = false

    let featureUpdated: Array<FeatureObject> = []

    const createObject = (type?: 'subclass', featureArray?: Array<FeatureObject>) => {
      if (featureArray.length > 0) {
        featureUpdated = [...featureArray]
      }

      const featureClass: Class =
        type === 'subclass' ? classes.find((fClass) => fClass.parentClass === fullClass.id) : fullClass

      const fullFeatures: Feature[] = featureClass.features

      fullFeatures?.forEach((feature) => {
        const featureLevel = feature.levelAvailable.split(/\s*,\s*/)
        if (featureLevel.length > 0) {
          featureLevel.forEach((level) => {
            // If feature has same level more than once, use that as selection count while only storing the feature one time otherwise ignore it
            const levelCount = featureLevel.reduce((count: number, rLevel: string) => {
              return count + (rLevel === level ? 1 : 0)
            }, 0)

            const featureObjectClone = {
              ...excludeFields(feature, 'options'),
              classId: featureClass.id,
              levelAvailable: Number(level),
            }

            if (levelCount > 1) {
              featureObjectClone.selectionCount = Number(levelCount)
            }

            const arrayIndex = featureUpdated?.findIndex((aFeature) => aFeature.level === Number(level))

            if (arrayIndex === -1) {
              featureUpdated.push({
                level: Number(level),
                features: [{ ...featureObjectClone }],
              })
            } else {
              const arrayObject = featureUpdated[arrayIndex]
              if (arrayObject && !arrayObject?.features.some((aFeature) => aFeature.id === feature.id)) {
                featureUpdated[arrayIndex].features = [...arrayObject.features, { ...featureObjectClone }]
              }
            }
          })
        }
      })
    }

    createObject()

    if (classes.some((uClass) => uClass.parentClass === fullClass.id) && !subclassMapped) {
      subclassMapped = true
      createObject('subclass', featureUpdated)
    }

    if (featureUpdated.length > 0) {
      const featuresSorted = featureUpdated
        .sort((a, b) => a.level - b.level)
        .map((fObject) => {
          fObject.features.sort((a, b) => a.value?.localeCompare(b.value))
          return fObject
        })
      featureUpdated = featuresSorted
    }

    return featureUpdated
  }, [classes, fullClass])

  // Memoize the feature array
  const features = useMemo(() => createFeatures(), [createFeatures])

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

  const hitpointAbility = system.abilities.find((ability) => ability.value === fullClass.hitpoint?.ability)

  // Memoize the proficiency array
  const proficiencies = useMemo(() => createProficiencies(), [createProficiencies])

  return !fullClass ? (
    <Spinner />
  ) : (
    <>
      {fullClass?.desc && <em>{parse(fullClass.desc)}</em>}
      <Collapse>
        <Collapse.Header title='Hit Points' className={feature_header} startOpened={true} />
        <Collapse.Body>
          <div>
            <strong>{'Hit Dice: '}</strong>
            {`${fullClass.hitpoint?.dieShort} per ${fullClass.value} level`}
          </div>
          <div>
            <strong>{'Hit Points at 1st Level: '}</strong>
            {`${fullClass.hitpoint?.dieCount * fullClass.hitpoint?.dieValue} + your ${
              fullClass.hitpoint.ability
            } modifier`}
          </div>
          <div>
            <strong>{'Hit Points at Higher Levels: '}</strong>
            {`${fullClass.hitpoint?.dieShort} (or ${Math.round(
              fullClass.hitpoint?.dieCount * (fullClass.hitpoint?.dieValue / 2) + 0.5
            )}) + your ${hitpointAbility.value} modifier per ${fullClass.value} level after 1st`}
          </div>
        </Collapse.Body>
      </Collapse>
      {proficiencies && (
        <Collapse>
          <Collapse.Header title='Proficiencies' className={feature_header} startOpened={true} />
          <Collapse.Body>
            {Object.keys(proficiencies).map((key) => {
              const typeArray = proficiencies[key]?.type
              const propertyArray = proficiencies[key]?.property ?? []
              const selectionCount = proficiencies[key]?.selectionCount ?? 0

              let typeText: string = ''

              if (propertyArray.length > 0) {
                if (selectionCount > 0) {
                  typeText = `Choose ${numberToWords(selectionCount)} from `
                }
                propertyArray.forEach((iProperty: any, pIndex: number) => {
                  if (selectionCount > 0) {
                    typeText += `${iProperty.value}s`
                  }

                  if (propertyArray.length > 1 && propertyArray.length < 3) {
                    if (pIndex !== propertyArray.length - 1) {
                      if (selectionCount) {
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
                      if (selectionCount) {
                        typeText += ' or '
                      } else {
                        typeText += ' and '
                      }
                    }
                  }
                })
              } else {
                if (typeArray?.some((type: any) => type.name === 'all')) {
                  if (selectionCount > 0) {
                    typeText = `Choose any ${numberToWords(selectionCount)}`
                  }
                } else {
                  if (selectionCount > 0) {
                    typeText = `Choose ${numberToWords(selectionCount)} from `
                  }
                  typeArray?.map((type: any, tIndex: number) => {
                    typeText += `${type.value}`

                    if (typeArray.length > 1 && typeArray.length < 3) {
                      if (tIndex !== typeArray.length - 1) {
                        if (selectionCount) {
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
                        if (selectionCount) {
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
                </div>
              )
            })}
          </Collapse.Body>
        </Collapse>
      )}
      {features?.map((fObject) =>
        fObject.features.flatMap((feature, fIndex) => {
          return (
            <Collapse key={fIndex}>
              <Collapse.Header
                title={`(${fObject.level}) ${feature.value}`}
                className={feature_header}
                startOpened={true}
              />
              <Collapse.Body>{feature.desc && parse(feature.desc)}</Collapse.Body>
            </Collapse>
          )
        })
      )}
    </>
  )
}

export default ClassShort
