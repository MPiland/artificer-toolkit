import { useCallback, useMemo, useEffect, Fragment } from 'react'
import { FeatureArrayType, ReducerActionType } from '../../../../utils/types'
import { useForm } from '../../../../hooks/UseForm'
import { get, set, isEqual } from 'lodash'
import Collapse from '../../../Collapse/Collapse'
import ScrollArea from '../../../ScrollArea/ScrollArea'
import Dropdown from '../../../Dropdown/Dropdown'
import { feature_card_header, option_dropdown } from '../Character.css'
import parse from 'html-react-parser'
import { sprinkles } from '../../../../css/sprinkles.css'
import { excludeFields } from '../../../../utils/form'
import { getSectionOptions, sectionData } from '../../../../utils/form'
import { useFeature } from '../../../../hooks/UseFeature'
import { useGetBuildersQuery } from '../../../../features/systems/systemsApi'
import { useGetClassesQuery } from '../../../../features/classes/classesApi'
import { useGetFeatsQuery } from '../../../../features/feats/featsApi'
import { useGetSpellsQuery } from '../../../../features/spells/spellsApi'
import { useGetEquipmentQuery } from '../../../../features/equipment/equipmentApi'

type FeatureObjectType = {
  available: FeatureArrayType[]
  unavailable: FeatureArrayType[]
}

const ClassFeaturePanel = ({ uClass, classIndex, fullClass }: { uClass: any; classIndex: number; fullClass: any }) => {
  const { formState, setFormState } = useForm()

  const { sectionNames } = useFeature()
  const { data: builders } = useGetBuildersQuery()
  const { data: classes } = useGetClassesQuery() as { data: any[] }
  const { data: feats } = useGetFeatsQuery() as { data: any[] }
  const { data: spells } = useGetSpellsQuery() as { data: any[] }
  const { data: items } = useGetEquipmentQuery() as { data: any[] }

  // Create feauture array for the selected class
  const createFeatures = useCallback(() => {
    let subclassMapped: boolean = false

    let featureUpdated: FeatureObjectType = { available: [], unavailable: [] }

    const createObject = (type?: 'subclass', featureObject?: FeatureObjectType) => {
      if (featureObject && Object.keys(featureObject).length > 0) {
        featureUpdated = { ...featureObject }
      }

      const featureClass: any = type === 'subclass' ? uClass.subclass : uClass

      const fullFeatures: any[] = classes.find((fClass: any) => fClass._id === featureClass._id).features

      fullFeatures?.forEach((feature: any) => {
        const featureLevel = feature.levelAvailable.split(/\s*,\s*/)
        if (featureLevel.length > 0) {
          featureLevel.forEach((level: string) => {
            // If feature has same level more than once, use that as selection count while only storing the feature one time otherwise ignore it
            const levelCount = featureLevel.reduce((count: number, rLevel: string) => {
              return count + (rLevel === level ? 1 : 0)
            }, 0)

            const featureObjectClone = {
              ...excludeFields(feature, 'options'),
              classId: featureClass._id,
              levelAvailable: Number(level),
            }

            // If options were previously selected and set of form state, copy those otherwise, ignore options
            const options =
              uClass.features?.find((cFeature: any) => {
                if (cFeature._id === feature._id) {
                  if (cFeature.levelAvailable) {
                    return cFeature.levelAvailable === Number(level)
                  } else {
                    return true
                  }
                }
                return false
              })?.options ?? []

            if (options?.length > 0) {
              set(featureObjectClone, 'options', options)
            }

            if (levelCount > 1) {
              set(featureObjectClone, 'selectionCount', Number(levelCount))
            }

            if (Number(level) <= uClass.level) {
              const arrayIndex = featureUpdated.available?.findIndex((aFeature) => aFeature.level === Number(level))

              if (arrayIndex === -1) {
                featureUpdated.available.push({
                  level: Number(level),
                  features: [{ ...featureObjectClone }],
                })
              } else {
                const arrayObject = featureUpdated.available[arrayIndex]
                if (arrayObject && !arrayObject?.features.some((aFeature: any) => aFeature._id === feature._id)) {
                  set(featureUpdated, `available.${arrayIndex}.features`, [
                    ...arrayObject.features,
                    { ...featureObjectClone },
                  ])
                }
              }
            } else {
              const arrayIndex = featureUpdated.unavailable?.findIndex((aFeature) => aFeature.level === Number(level))

              if (arrayIndex === -1) {
                featureUpdated.unavailable.push({
                  level: Number(level),
                  features: [{ ...featureObjectClone }],
                })
              } else {
                const arrayObject = featureUpdated.unavailable[arrayIndex]
                if (arrayObject && !arrayObject?.features.some((aFeature: any) => aFeature._id === feature._id)) {
                  set(featureUpdated, `unavailable.${arrayIndex}.features`, [
                    ...arrayObject.features,
                    { ...featureObjectClone },
                  ])
                }
              }
            }
          })
        }
      })
    }

    createObject()

    if (uClass.subclass && !subclassMapped) {
      subclassMapped = true
      createObject('subclass', featureUpdated)
    }

    if (featureUpdated.available.length > 0) {
      const available = featureUpdated.available
        .sort((a, b) => a.level - b.level)
        .map((fObject) => {
          fObject.features.sort((a, b) => a.feature?.name?.localeCompare(b.feature.name))
          return fObject // Ensure you return the object after sorting its features
        })
      set(featureUpdated, 'available', available)
    }

    if (featureUpdated.unavailable.length > 0) {
      const unavailable = featureUpdated.unavailable
        .sort((a, b) => a.level - b.level)
        .map((fObject) => {
          fObject.features.sort((a, b) => a.feature?.name?.localeCompare(b.feature.name))
          return fObject // Ensure you return the object after sorting its features
        })
      set(featureUpdated, 'unavailable', unavailable)
    }

    return featureUpdated
  }, [classes, uClass])

  // Memoize the feature array
  const features = useMemo(() => createFeatures(), [createFeatures])

  // Create the different feature sections
  const createClassData = useCallback(() => {
    let subclassMapped: boolean = false
    let formStateUpdated: any = JSON.parse(JSON.stringify(formState))

    const createObject = (type?: 'subclass', formStateSectionObject?: any) => {
      if (formStateSectionObject) {
        formStateUpdated = formStateSectionObject
      }

      const sectionClass: any = type === 'subclass' ? uClass.subclass : uClass

      const fullClass = classes?.find((classItem: any) => sectionClass._id === classItem._id)

      if (features.available && features.available?.length > 0) {
        features?.available?.forEach((aObject) => {
          if (aObject.features?.length > 0) {
            aObject.features.forEach((feature: any) => {
              const fullFeature = fullClass.features?.find((cFeature: any) => cFeature._id === feature._id)
              sectionNames.forEach((sectionName) => {
                if (sectionName !== 'features' && sectionName !== 'ancestry' && sectionName !== 'options') {
                  let sectionObject: any = {}
                  const sectionClone: any = get(formStateUpdated, `${sectionName}`)
                  if (sectionClone) {
                    if (!Array.isArray(sectionClone) && Object.keys(sectionClone)?.length > 0) {
                      Object.keys(sectionClone).forEach((key: string) => {
                        const section = sectionClone[key]
                        if (Array.isArray(section) && section?.length > 0) {
                          section.forEach((sectionItem: any) => {
                            if (
                              sectionItem?.classId == null ||
                              formStateUpdated.class.some((uClass: any) => uClass._id === sectionItem.classId)
                            ) {
                              if (sectionObject[key]?.length > 0) {
                                const exist = get(sectionObject, key)
                                exist.push(sectionItem)
                                set(sectionObject, key, exist)
                              } else {
                                set(sectionObject, key, [sectionItem])
                              }
                            }
                          })
                        }
                      })
                    }
                    if (Array.isArray(sectionClone) && sectionClone.length > 0) {
                      sectionClone.forEach((section: any) => {
                        if (
                          section.classId == null ||
                          formStateUpdated.class.some((uClass: any) => uClass._id === section.classId)
                        ) {
                          if (sectionObject?.length > 0) {
                            sectionObject = [...sectionObject, { ...section }]
                          } else {
                            sectionObject = [{ ...section }]
                          }
                        }
                      })
                    }
                  }
                  if (fullFeature?.[sectionName]?.length > 0) {
                    fullFeature[sectionName].forEach((section: any) => {
                      if (!section?.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
                        sectionObject = sectionData({
                          section,
                          sectionObject,
                          item: sectionClass,
                          itemType: 'class',
                          feature: fullFeature,
                          builders,
                        })
                      }
                    })
                  }
                  if (fullClass?.[sectionName]?.length > 0) {
                    fullClass[sectionName].forEach((section: any) => {
                      if (!section?.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
                        sectionObject = sectionData({
                          section,
                          sectionObject,
                          item: sectionClass,
                          itemType: 'class',
                          feature: fullClass,
                          builders,
                        })
                      }
                    })
                  }
                  if (Object.keys(sectionObject).length > 0) {
                    if (!isEqual(sectionObject, sectionClone)) {
                      set(formStateUpdated, sectionName, sectionObject)
                    }
                  } else if (sectionClone && Object.keys(sectionClone).length > 0) {
                    set(formStateUpdated, sectionName, undefined)
                  }
                }
              })
            })
          }
        })
      }
    }

    createObject()

    if (uClass.subclass && !subclassMapped) {
      subclassMapped = true
      createObject('subclass', formStateUpdated)
    }

    return formStateUpdated
  }, [formState, sectionNames, classes, uClass, features, builders])

  // Memoize the feature sections
  const formStateUpdated = useMemo(() => createClassData(), [createClassData])

  // Update state sections
  useEffect(() => {
    if (!isEqual(formStateUpdated, formState)) {
      setFormState({
        type: 'reset',
        target: { value: formStateUpdated },
      })
    }
  }, [formState, setFormState, formStateUpdated])

  // Update class features
  useEffect(() => {
    const availableFeatures = features.available.flatMap((aObject) => aObject.features)
    if (!isEqual(availableFeatures, uClass.features)) {
      setFormState({
        target: {
          name: `class.${classIndex}.features`,
          value: availableFeatures,
        },
      })
    }
  }, [setFormState, uClass.features, features.available, classIndex])

  const handleOptionChange = (e: ReducerActionType, featureIndex: number, featureId: number) => {
    const option = get(formState, `${e.target.name}`)

    if (e.type === 'removed' || (!isEqual(option, e.target.value) && option)) {
      const formClone = JSON.parse(JSON.stringify(formState))
      sectionNames
        .filter((sectionName) => sectionName !== 'features')
        .forEach((sectionName) => {
          if (formState?.[sectionName] && option?.[sectionName]) {
            const optionArray = option?.[sectionName]
            optionArray?.forEach((optionItem: any) => {
              const categoryName = optionItem?.category?.name
              if (categoryName) {
                if (
                  !optionItem[categoryName]?.attribute?.some((attribute: any) => attribute.name === 'providesOptions')
                ) {
                  if (formState?.[sectionName]?.[categoryName]?.length > 0) {
                    const categoryArray = formState?.[sectionName]?.[categoryName]
                    if (categoryArray?.length > 0) {
                      const optionIndex = categoryArray.findIndex((cItem: any) => {
                        return cItem?.featureId === option.featureId && cItem?.optionIndex === option.optionIndex
                      })
                      if (optionIndex !== -1) {
                        if (get(formClone, `${sectionName}.${categoryName}`)?.length === 1) {
                          delete formClone[sectionName][categoryName]
                        } else {
                          delete formClone[sectionName][categoryName][optionIndex]
                        }
                      }
                      if (formClone[sectionName] === null) {
                        delete formClone[sectionName]
                      }
                    }
                  }
                }
              }
            })
          }
          if (!isEqual(option, e.target.value)) {
            set(formClone, `${e.target.name}`, e.target.value)
            e.target.value?.[sectionName]?.map((section: any) => {
              const categoryName: string = section?.category?.name
              let cloneObject: any = {}
              let sectionObject: any = {}
              if (categoryName) {
                sectionObject = sectionData({
                  section: section?.[categoryName],
                  sectionObject: {},
                  item: uClass,
                  itemType: 'class',
                  builders,
                })
              } else {
                sectionObject = sectionData({ section, sectionObject: {}, item: uClass, itemType: 'class', builders })
              }
              if (!sectionObject?.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
                if (sectionObject?.length > 0) {
                  sectionObject?.forEach((_: any, sIndex: number) => {
                    const optionIndex = sIndex + featureIndex
                    set(sectionObject, `${sIndex}.optionIndex`, optionIndex)
                    set(sectionObject, `${sIndex}.featureId`, featureId)
                  })
                }
                if (categoryName !== '') {
                  cloneObject = get(formClone, `${sectionName}.${categoryName}`)
                  if (!isEqual(sectionObject, cloneObject) && sectionObject.length > 0) {
                    if (formClone?.[sectionName]?.[categoryName]?.every((cItem: any) => cItem == null)) {
                      set(formClone, `${sectionName}.${categoryName}`, [...(sectionObject ?? [])])
                    } else {
                      set(formClone, `${sectionName}.${categoryName}`, [
                        ...(formClone?.[sectionName]?.[categoryName] ?? []),
                        ...(sectionObject ?? []),
                      ])
                    }
                    if (!isEqual(formClone, formState)) {
                      setFormState({
                        type: 'reset',
                        target: {
                          value: formClone,
                        },
                      })
                    }
                  }
                } else {
                  cloneObject = get(formState, `${sectionName}`)
                }
              }
            })
          }
        })
      if (!isEqual(formClone, formState)) {
        setFormState({
          type: 'reset',
          target: {
            value: formClone,
          },
        })
      }
    } else {
      setFormState({
        target: {
          name: e.target.name,
          value: e.target.value,
        },
      })
    }
  }

  const subClasses = classes.filter((uClass: any) => uClass?.parentClass?._id === uClass._id)

  return features.available.map((aObject, aIndex) =>
    aObject.features.map((feature, fIndex) => {
      const featureLevel = aObject.level
      const featureIndex = aIndex + fIndex
      if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideInBuilder')) {
        const fullFeature = classes
          .find((stateClass: any) => stateClass._id === feature.classId)
          .features.find((uFeature: any) => uFeature._id === feature._id)
        return (
          <Collapse key={featureIndex}>
            <Collapse.Header title={`(${featureLevel}) ${fullFeature.value}`} className={feature_card_header} />
            <Collapse.Body>
              <ScrollArea scrollDirection='horizontal'>
                {fullFeature.type.name === 'subclass' && parse(fullFeature?.detail)}
                {fullFeature.desc && parse(fullFeature.desc)}
                {fullFeature.type.name === 'subclass' && (
                  <>
                    <Dropdown
                      name={`class.${classIndex}.subclass`}
                      className={sprinkles({
                        mx: 'space-15',
                        width: 'size-auto',
                      })}
                      label={'Subclass Option'}
                      options={subClasses.map((subclass: any) => ({
                        name: subclass?.name,
                        value: subclass?.value,
                        _id: subclass?._id,
                      }))}
                      onChange={setFormState}
                      value={uClass.subclass}
                    />
                    {classes.find((cClass: any) => uClass.subclass?._id === cClass._id)?.subtype?.length > 0 && (
                      <Dropdown
                        name={`class.${classIndex}.subclass.subtype`}
                        className={sprinkles({
                          mx: 'space-15',
                          width: 'size-auto',
                        })}
                        label={'Subtype Option'}
                        options={classes
                          .find((cClass: any) => uClass.subclass._id === cClass._id)
                          .subtype.map((subtype: any) => ({
                            name: subtype?.name,
                            value: subtype?.value,
                            _id: subtype?._id,
                          }))}
                        onChange={setFormState}
                        value={uClass.subclass.subtype}
                      />
                    )}
                  </>
                )}
                {!(fullFeature?.options?.length > 0)
                  ? sectionNames.map((sectionName, nameIndex) => (
                      <Fragment key={nameIndex}>
                        {fullFeature[sectionName]?.length > 0 &&
                          fullFeature[sectionName].map((section: any) => {
                            if (sectionName !== 'options') {
                              if (
                                section?.attribute?.some(
                                  (attributeItem: any) => attributeItem.name === 'providesOptions'
                                )
                              ) {
                                // Check if selectionCount exists and is greater than 0
                                const selectionCount = section?.selectionCount || 1

                                // Repeat Dropdown component based on selectionCount
                                const dropdowns = Array.from({ length: selectionCount }, (_, index) => {
                                  const optionIndex = `${index}` + `${featureIndex}` + `${classIndex}`

                                  const { options, label, inputPathName, exist } = getSectionOptions({
                                    section,
                                    sectionName,
                                    feature: feature,
                                    optionIndex,
                                    state: formState,
                                    builders,
                                    feats,
                                    spells,
                                    items,
                                    featureType: 'class',
                                  })

                                  return (
                                    <Dropdown
                                      key={index}
                                      name={`${inputPathName}`}
                                      className={sprinkles({
                                        mx: 'space-15',
                                        width: 'size-auto',
                                      })}
                                      label={`${label} Option`}
                                      options={options}
                                      onChange={setFormState}
                                      value={exist}
                                    />
                                  )
                                })

                                return dropdowns
                              }
                            }
                          })}
                      </Fragment>
                    ))
                  : (() => {
                      const selectionCount =
                        uClass.features?.find((cFeature: any) => {
                          return (
                            cFeature._id === feature._id &&
                            cFeature.selectionCount &&
                            cFeature.levelAvailable === featureLevel
                          )
                        })?.selectionCount ?? 1 // Repeat Dropdown component based on selectionCount

                      const dropdowns = Array.from({ length: selectionCount }, (_, index) => {
                        const optionIndex = `${index}` + `${featureIndex}` + `${classIndex}`

                        const { options, inputPathName, exist } = getSectionOptions({
                          section: fullFeature,
                          sectionName: 'options',
                          feature,
                          optionIndex,
                          state: formState,
                          builders,
                          feats,
                          spells,
                          items,
                          featureType: 'class',
                          featureLevel,
                        })

                        return (
                          <div className={option_dropdown} key={index}>
                            <Dropdown
                              name={`${inputPathName}`}
                              label={`${feature.value} Option`}
                              options={options}
                              onChange={(e) => handleOptionChange(e, featureIndex, feature._id)}
                              value={exist}
                            />
                            {exist?.desc && parse(exist.desc)}
                          </div>
                        )
                      })

                      return dropdowns
                    })()}
                {(() => {
                  const formFeature = fullClass?.features?.find((aFeature: any) => aFeature._id === feature?._id)

                  if (formFeature && formFeature.options) {
                    const option = formFeature.options
                    return (
                      <div>
                        {option.desc && <div>{parse(option.desc)}</div>}
                        {sectionNames.map((sectionName, nameIndex) => {
                          return (
                            <Fragment key={nameIndex}>
                              {option[sectionName]?.length > 0 &&
                                option[sectionName].map((section: any) => {
                                  if (sectionName !== 'options') {
                                    if (
                                      section.attribute?.some(
                                        (attributeItem: any) => attributeItem.name === 'providesOptions'
                                      )
                                    ) {
                                      // Check if selectionCount exists and is greater than 0
                                      const selectionCount = section?.selectionCount || 1

                                      // Repeat Dropdown component based on selectionCount
                                      const dropdowns = Array.from({ length: selectionCount }, (_, index) => {
                                        const optionIndex = `${index}` + `${featureIndex}` + `${classIndex}`

                                        const { options, label, inputPathName, exist } = getSectionOptions({
                                          section,
                                          sectionName,
                                          feature,
                                          optionIndex,
                                          state: formState,
                                          builders,
                                          feats,
                                          spells,
                                          items,
                                          featureType: 'class',
                                        })

                                        return (
                                          <div className={option_dropdown} key={index}>
                                            <Dropdown
                                              name={`${inputPathName}`}
                                              label={`${label} Option`}
                                              options={options}
                                              onChange={setFormState}
                                              value={exist}
                                            />
                                            {exist?.desc && parse(exist.desc)}
                                          </div>
                                        )
                                      })

                                      return dropdowns
                                    }
                                  }
                                })}
                            </Fragment>
                          )
                        })}
                      </div>
                    )
                  }
                })()}
              </ScrollArea>
            </Collapse.Body>
          </Collapse>
        )
      }
    })
  )
}

export default ClassFeaturePanel
