import parse from 'html-react-parser'
import { useLocation } from 'react-router-dom'
import Spinner from '../../components/Spinner/Spinner'
import Collapse from '../../components/Collapse/Collapse'
import { feature_header } from './ClassShort.css'
import { useCallback, useMemo } from 'react'
import { set, startCase, uniqBy } from 'lodash'
import { numberToWords } from '../../utils/formatting'
import { useListEquipmentQuery } from '../equipment/equipmentApi'
import { FeatureArray, ClassProficiency } from '../../types/components'

const ClassShort = () => {
  const location: any = useLocation()

  const { data: items } = useListEquipmentQuery() as { data: any[] }

  const uClass = location.state.item

  const createFeatures = useCallback(
    (featureArray?: FeatureArray[]) => {
      let featureArrayUpdated: FeatureArray[] = []

      if (featureArray && featureArray.length > 0) {
        featureArrayUpdated = [...featureArray]
      }

      const fullFeatures: any[] = uClass.features

      fullFeatures?.forEach((feature: any) => {
        const featureLevel = feature.levelAvailable.split(', ')
        if (featureLevel.length > 0) {
          featureLevel.forEach((level: string) => {
            const arrayIndex = featureArrayUpdated.findIndex((fObject) => fObject.level === Number(level))
            if (arrayIndex === -1) {
              featureArrayUpdated.push({ level: Number(level), features: [{ ...feature }] })
            } else {
              const arrayLevel = featureArrayUpdated[arrayIndex]
              if (arrayLevel && !arrayLevel?.features.some((aFeature: any) => aFeature._id === feature._id)) {
                set(featureArrayUpdated, `${arrayIndex}.features`, [...arrayLevel.features, { ...feature }])
              }
            }
          })
        }
      })

      if (featureArrayUpdated.length > 0) {
        featureArrayUpdated = featureArrayUpdated
          .sort((a, b) => a.level - b.level)
          .map((fObject) => {
            fObject.features.sort((a, b) => a.feature?.name?.localeCompare(b.feature.name))
            return fObject // Ensure you return the object after sorting its features
          })
      }

      return featureArrayUpdated
    },
    [uClass]
  )

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

    const fullProficiencies = uClass.proficiencies

    let proficiencyObject: ClassProficiency = {}

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
          const itemProperty: any[] = proficiency[categoryName]?.property?.type ?? []

          const existType: any[] = [...(proficiencyObject[itemCategory]?.type ?? [])]

          if (profType.some((prof: any) => prof.name === 'all')) {
            const filteredType = items
              .filter((item: any) => item.category._id === proficiency[categoryName].category._id)
              .filter((item: any) =>
                itemProperty.length > 0
                  ? itemProperty.some((iProperty: any) =>
                      item?.property?.type?.some((property: any) => iProperty._id === property._id)
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
  }, [items, uClass])

  const features = useMemo(() => createFeatures(), [createFeatures])
  const proficiencies = useMemo(() => createProficiencies(), [createProficiencies])
  return !uClass ? (
    <Spinner />
  ) : (
    <>
      {uClass?.desc && <em>{parse(uClass.desc)}</em>}
      <Collapse>
        <Collapse.Header title='Hit Points' className={feature_header} startOpened={true} />
        <Collapse.Body>
          <div>
            <strong>{'Hit Dice: '}</strong>
            {`${uClass.hitpoint?.diceShort} per ${uClass.value} level`}
          </div>
          <div>
            <strong>{'Hit Points at 1st Level: '}</strong>
            {`${uClass.hitpoint?.diceCount * uClass.hitpoint?.diceValue.value} + your ${
              uClass.hitpoint.ability.value
            } modifier`}
          </div>
          <div>
            <strong>{'Hit Points at Higher Levels: '}</strong>
            {`${uClass.hitpoint?.diceShort} (or ${Math.round(
              uClass.hitpoint?.diceCount * (uClass.hitpoint?.diceValue.value / 2) + 0.5
            )}) + your ${uClass.hitpoint.ability.value} modifier per ${uClass.value} level after 1st`}
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
        fObject.features.flatMap((feature: any, fIndex: number) => {
          if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideInBuilder')) {
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
          }
        })
      )}
    </>
  )
}

export default ClassShort
