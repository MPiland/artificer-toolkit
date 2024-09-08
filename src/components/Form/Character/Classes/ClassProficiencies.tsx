import { useCallback, useMemo } from 'react'
import Collapse from '../../../Collapse/Collapse'
import Dropdown from '../../../Dropdown/Dropdown'
import { sprinkles } from '../../../../css/sprinkles.css'
import { useForm } from '../../../../hooks/UseForm'
import { startCase, uniqBy, set } from 'lodash'
import { ClassProficiencyType } from '../../../../utils/types'
import { feature_card_header } from '../Character.css'
import { numberToWords } from '../../../../utils/formatting'
import { getSectionOptions } from '../../../../utils/form'
import { useGetClassesQuery } from '../../../../features/classes/classesApi'
import { useGetEquipmentQuery } from '../../../../features/equipment/equipmentApi'
import { useGetBuildersQuery } from '../../../../features/builders/buildersApi'

const ClassProficiencies = ({ fullClass, uClass, classIndex }: { fullClass: any; uClass: any; classIndex: number }) => {
  const { formState, setFormState } = useForm()

  const { data: builders } = useGetBuildersQuery()
  const { data: classes } = useGetClassesQuery() as { data: any[] }
  const { data: items } = useGetEquipmentQuery() as { data: any[] }

  // Create the proficiencies array
  const createProficiencies = useCallback(() => {
    const sortObjectFields = (obj: any, stateOrder: any[]) => {
      let sortedKeys: string[] = []
      const sortedObjects: any = {}
      stateOrder.forEach((order) => {
        const categoryName = order.category.name
        if (order[categoryName]?.category?.name) {
          sortedKeys.push(order[categoryName]?.category?.name)
        } else {
          sortedKeys.push(categoryName)
        }
      })

      sortedKeys = uniqBy(sortedKeys, (key) => key)

      sortedKeys.forEach((key) => {
        sortedObjects[key] = obj[key]
      })

      return sortedObjects
    }

    const fullProficiencies = classes.find((classItem: any) => classItem._id === uClass._id).proficiencies

    let proficiencyObject: ClassProficiencyType = {}

    fullProficiencies?.forEach((proficiency: any) => {
      const categoryName: string = proficiency.category?.name
      if (proficiency[categoryName]?.type?.length > 0) {
        const profType = proficiency[categoryName]?.type
        if (categoryName === 'properties') {
          const itemCategory: string = proficiency[categoryName]?.category?.name
          const existType: any[] = [...(proficiencyObject[itemCategory]?.type ?? [])]

          if (profType.some((prof: any) => prof.name === 'all')) {
            const filteredType = items
              .filter((item: any) => item.category._id === proficiency[categoryName].category._id)
              .flatMap((item: any) => item.properties.type)
            if (
              !existType.some((type: any) => filteredType?.some((filteredItem: any) => filteredItem._id === type._id))
            ) {
              set(proficiencyObject, itemCategory, {
                type: [...existType, ...filteredType],
                selectionCount: proficiency.selectionCount ?? null,
              })
            }
          } else {
            if (!existType.some((type: any) => profType?.some((profType: any) => profType._id === type._id))) {
              set(proficiencyObject, itemCategory, {
                type: [...existType, ...profType],
                selectionCount: proficiency.selectionCount ?? null,
              })
            }
          }
        } else if (categoryName === 'items') {
          const itemCategory: string = proficiency[categoryName]?.category?.name
          const itemProperty: any[] = proficiency[categoryName]?.properties?.type ?? []

          const existType: any[] = [...(proficiencyObject[itemCategory]?.type ?? [])]

          if (profType.some((prof: any) => prof.name === 'all')) {
            const filteredType = items
              .filter((item: any) => item.category._id === proficiency[categoryName].category._id)
              .filter((item: any) =>
                itemProperty.length > 0
                  ? itemProperty.some((iProperty: any) =>
                      item?.properties?.type?.some((property: any) => iProperty._id === property._id)
                    )
                  : item
              )
            if (
              !existType.some((type: any) => filteredType?.some((filteredItem: any) => filteredItem._id === type._id))
            ) {
              set(proficiencyObject, itemCategory, {
                type: [...existType, ...filteredType],
                selectionCount: proficiency.selectionCount ?? null,
                property: itemProperty,
              })
            }
          } else {
            if (!existType.some((type: any) => profType?.some((profType: any) => profType._id === type._id))) {
              set(proficiencyObject, itemCategory, {
                type: [...existType, ...profType],
                selectionCount: proficiency.selectionCount ?? null,
              })
            }
          }
        } else {
          const existType = [...(proficiencyObject[categoryName]?.type ?? [])]

          if (
            !existType.some((type: any) => profType?.some((profTypeObject: any) => profTypeObject._id === type._id))
          ) {
            set(proficiencyObject, categoryName, {
              type: [...existType, ...profType],
              selectionCount: proficiency.selectionCount ?? null,
            })
          }
        }
      }
    })

    proficiencyObject = sortObjectFields(proficiencyObject, fullProficiencies)

    return proficiencyObject
  }, [classes, items, uClass._id])

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

            const fullProficiency = fullClass.proficiencies.find((proficiency: any) => {
              const categoryName = proficiency.category.name

              if (proficiency[categoryName]?.category?.name) {
                return key === proficiency[categoryName]?.category?.name
              } else {
                return key === categoryName
              }
            })

            const dropdowns = () =>
              Array.from({ length: selectionCount ?? 0 }, (_, index) => {
                const optionIndex = `${index}` + `${pIndex}` + `${classIndex}`

                const { options, inputPathName, exist } = getSectionOptions({
                  section: fullProficiency,
                  sectionName: 'proficiencies',
                  optionIndex,
                  feature: { classId: fullClass._id },
                  state: formState,
                  builders,
                  items,
                  featureType: 'class',
                })

                // Render the Dropdown component inside the loop
                return (
                  <Dropdown
                    key={index}
                    name={`${inputPathName}`}
                    className={sprinkles({
                      mx: 'space-15',
                      width: 'size-auto',
                    })}
                    label={`${startCase(key)} Option`}
                    options={options}
                    onChange={setFormState}
                    value={exist}
                  />
                )
              })

            let typeText: string = ''

            if (propertyArray.length > 0) {
              if (selectionCount != null) {
                typeText = `Choose ${numberToWords(selectionCount)} from `
              }
              propertyArray.forEach((iProperty: any, pIndex: number) => {
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
              if (typeArray?.some((type: any) => type.name === 'all')) {
                if (selectionCount != null) {
                  typeText = `Choose any ${numberToWords(selectionCount)}`
                }
              } else {
                if (selectionCount != null) {
                  typeText = `Choose ${numberToWords(selectionCount)} from `
                }
                typeArray?.map((type: any, tIndex: number) => {
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
