import parse from 'html-react-parser'
import { Fragment, useContext, useEffect, useState } from 'react'
import { getSectionNames } from '../../../utils/formUtils'
import { SectionName } from '../../../utils/types'
import Dropdown from '../../Dropdown/Dropdown'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { get, isEqual, set } from 'lodash'
import { sprinkles } from '../../../css/sprinkles.css'
import { feature_card_body } from './Character.css'
import Collapse from '../../Collapse/Collapse'
import { form_content } from '../Form.css'
import Group from '../../Group/Group'
import Input from '../../Input/Input'
import Grid from '../../Grid/Grid'
import { useGetBuildersQuery } from '../../../features/builder/builderApiSlice'
import { selectAllClasses, useGetClassesQuery } from '../../../features/class/classApiSlice'
import { FormStepsContext } from '../FormStepsContext'

const ClassFeatureFormTest = () => {
  const { formState, selectedClass, setFormState } = useContext(FormStepsContext)

  const [formFeatures, setFormFeatures] = useState<{
    [key: string]: {
      level: number
      available: Array<{ level: number; feature: any }>
      unavailable: Array<{ level: number; feature: any }>
    }
  }>({})

  const sectionNames = getSectionNames()

  const { data: builders } = useGetBuildersQuery(undefined)

  const { classes }: { classes: any } = useGetClassesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
    }),
  })

  // Set classes
  useEffect(() => {
    let classIndex: number
    if (!(formState.class?.length > 0)) {
      classIndex = 0
      selectedClass.map((uClass: any) => {
        setFormState({
          target: {
            name: `class.${classIndex}`,
            value: { name: uClass?.name, value: uClass?.value, _id: uClass?._id, level: 1 },
          },
        })
      })
    }
    if (formState.class?.length > 0) {
      classIndex = formState.class?.length
      selectedClass.map((uClass: any) => {
        if (!formState.class.some((formClass: any) => formClass._id === uClass._id)) {
          setFormState({
            target: {
              name: `class.${classIndex}`,
              value: { name: uClass?.name, value: uClass?.value, _id: uClass?._id },
            },
          })
        }
      })
      formState.class.map((formClass: any, index: number) => {
        if (!selectedClass.some((uClass: any) => formClass._id === uClass._id)) {
          setFormState({
            type: 'removed',
            target: {
              name: `class.${index}`,
            },
          })
        }
      })
    }
  }, [formState.class, selectedClass, setFormState])

  // Set class hitpoints
  useEffect(() => {
    if (formState.class?.length > 0) {
      formState.class.map((uClass: any, index: number) => {
        const fullClass = classes?.find((classItem: any) => uClass._id === classItem._id)
        if (!uClass.hitPoint) {
          const hitDiceCount = fullClass?.hitPoint.diceCount
          const hitDiceValue = fullClass?.hitPoint.diceValue
          const hitDiceTotal = uClass.level
          const hitPoint = { total: hitDiceTotal, diceCount: hitDiceCount, diceValue: hitDiceValue }
          setFormState({
            target: {
              name: `class.${index}.hitPoint`,
              value: hitPoint,
            },
          })
        }
        if (uClass.hitPoint && uClass.hitPoint.total !== uClass.level) {
          setFormState({
            target: {
              name: `class.${index}.hitPoint.total`,
              value: uClass.level,
            },
          })
        }
      })
    }
  }, [classes, formState.class, setFormState])

  // Set Form features based on classes selected and the assigned level of classes
  useEffect(() => {
    if (formState.class?.length > 0) {
      formState.class.map((uClass: any) => {
        if (!formFeatures[uClass.name] || formFeatures[uClass.name].level !== uClass.level) {
          const classLevel = uClass.level
          let available: { level: number; feature: any }[] = []
          let unavailable: { level: number; feature: any }[] = []

          const classFeatures: any[] = classes.find((classItem: any) => classItem._id === uClass._id).feature

          classFeatures.forEach((feature: any) => {
            const featureLevel = feature.levelAvailable.split(', ')
            if (featureLevel.length > 0) {
              featureLevel.forEach((level: string) => {
                if (Number(level) <= uClass.level) {
                  available = [...available, { level: Number(level), feature: { ...feature, classId: uClass._id } }]
                } else {
                  unavailable = [...unavailable, { level: Number(level), feature: { ...feature, classId: uClass._id } }]
                }
              })
            }
          })
          available = available.sort((a, b) => {
            if (a.level === b.level) {
              return a.feature.name.localeCompare(b.feature.name)
            }
            return a.level > b.level ? 1 : -1
          })
          unavailable = unavailable.sort((a, b) => {
            if (a.level === b.level) {
              return a.feature.name.localeCompare(b.feature.name)
            }
            return a.level > b.level ? 1 : -1
          })
          setFormFeatures({ [uClass.name]: { available: available, unavailable: unavailable, level: classLevel } })
        }
      })
    }
  }, [classes, formFeatures, formState.class])

  // Set/Remove Class Features
  useEffect(() => {
    const formClone = JSON.parse(JSON.stringify(formState))
    if (formClone.class?.length > 0) {
      const cloneFeatures: any[] = []
      formClone.class?.map((uClass: any) => {
        if (formFeatures[uClass.name]?.available?.length > 0) {
          formFeatures[uClass.name]?.available?.map((availableFeature: any) => {
            const feature = availableFeature.feature
            if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideOnSheet')) {
              cloneFeatures.push({
                name: feature.name,
                value: feature.value,
                _id: feature._id,
                classId: uClass._id,
              })
            }
          })
        }
        if (formClone.feature?.length > 0) {
          formClone.feature?.forEach((feature: any) => {
            if (feature.classId == null) {
              cloneFeatures.push(feature)
            }
          })
        }
        if (!(cloneFeatures?.length > 0) && formClone.feature?.length > 0) {
          setFormState({
            type: 'removed',
            target: { name: 'feature' },
          })
        }
        if (!isEqual(cloneFeatures, formClone.feature) && cloneFeatures?.length > 0) {
          set(formClone, 'feature', cloneFeatures)

          setFormState({
            target: {
              name: 'feature',
              value: get(formClone, 'feature'),
            },
          })
        }
      })
    }
  }, [formState, setFormState, formFeatures])

  const sectionData = (section: any, sectionObject: any, uClass: any, feature?: any) => {
    const sectionArray: any[] = []
    const categoryName = section.category?.name

    if (!section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
      if (categoryName) {
        if (section[categoryName]?.type?.length > 0) {
          if (sectionObject[categoryName]?.length > 0) {
            const existArray = [...sectionObject[categoryName]]
            sectionArray.push(...existArray)
          }

          //eslint-disable-next-line
          const { _id, type, ...sectionFields } = section[categoryName]

          type?.forEach((type: any) => {
            if (!sectionArray.some((section: any) => section._id === type._id)) {
              let typeObject: any = { ...type, classId: uClass._id, ...sectionFields }
              if (feature) {
                typeObject = { ...typeObject, featureId: feature._id }
              }

              sectionArray.push(typeObject)
            }
          })

          if (sectionArray?.length > 0) {
            sectionObject = {
              ...sectionObject,
              [categoryName]: [...sectionArray],
            }
          }
        }
      }
      if (section.type?.length > 0) {
        if (sectionObject?.type?.length > 0) {
          const existArray = sectionObject?.type
          sectionArray.push(...existArray)
        }
        section?.type?.map((type: any) => {
          if (!sectionArray.some((section: any) => section._id === type._id)) {
            const typeObject: any = { ...type, uClass: uClass._id, featureId: feature._id }

            sectionArray.push(typeObject)
          }
        })

        if (sectionArray?.length > 0) {
          sectionObject = [...sectionArray]
        }
      }
    }

    return sectionObject
  }

  // Update sections from Class features
  useEffect(() => {
    const formClone = JSON.parse(JSON.stringify(formState))
    sectionNames.forEach((sectionName: any) => {
      if (sectionName !== 'feature' && sectionName !== 'option' && sectionName !== 'ancestry') {
        let sectionObject: any = {}
        const cloneObject: any = get(formClone, `${sectionName}`)
        if (cloneObject) {
          if (!Array.isArray(cloneObject) && Object.keys(cloneObject)?.length > 0) {
            Object.keys(cloneObject).forEach((key: string) => {
              const section = cloneObject[key]
              if (Array.isArray(section) && section?.length > 0) {
                section.forEach((sectionItem: any) => {
                  if (
                    sectionItem.classId == null ||
                    formClone.class.some((uClass: any) => uClass._id === sectionItem.classId)
                  )
                    if (sectionObject[key]?.length > 0) {
                      sectionObject = { ...sectionObject, [key]: [...sectionObject[key], { ...sectionItem }] }
                    } else {
                      sectionObject = { ...sectionObject, [key]: [{ ...sectionItem }] }
                    }
                })
              }
            })
          }
          if (Array.isArray(cloneObject) && cloneObject.length > 0) {
            cloneObject.forEach((sectionItem: any) => {
              if (sectionObject?.length > 0) {
                sectionObject = [...sectionObject, { ...sectionItem }]
              } else {
                sectionObject = [{ ...sectionItem }]
              }
            })
          }
        }
        if (formClone.class?.length > 0) {
          formClone.class.forEach((formClass: any) => {
            const uClass = classes.find((stateClass: any) => stateClass._id === formClass._id)
            if (uClass.feature?.length > 0) {
              uClass.feature?.forEach((feature: any) => {
                if (feature[sectionName]?.length > 0) {
                  feature[sectionName].forEach((section: any) => {
                    sectionObject = sectionData(section, sectionObject, uClass, feature)
                  })
                }
              })
            }
          })
        }
        if (Object.keys(sectionObject).length > 0) {
          if (!isEqual(sectionObject, cloneObject)) {
            set(formClone, sectionName, sectionObject)
          }
        }
        if (!isEqual(formClone, formState)) {
          setFormState({
            type: 'reset',
            target: { value: formClone },
          })
        }
      }
    })
  }, [sectionNames, setFormState, formState, selectedClass, classes])

  return (
    <ScrollArea scrollDirection='vertical' className={form_content}>
      {formState.class?.length > 0 &&
        formState.class?.map((uClass: any, index: number) => {
          return (
            <Fragment key={index}>
              <Group
                directionVariant='row'
                justifyContentVariant='spaceBetween'
                alignItemsVariant='end'
                className={sprinkles({ mb: 'size-3' })}
              >
                <Group>
                  <h1>{uClass.value}</h1>
                </Group>
                <Grid cols={{ base: 1 }} className={sprinkles({ width: 'auto' })}>
                  <Input
                    label='Level'
                    name={`class.${index}.level`}
                    value={formState.class[index].level}
                    errorMsg='Enter whole numbers only.'
                    validation='num'
                    onChange={setFormState}
                  />
                </Grid>
              </Group>
              <Collapse title={'Class Features'} style='borderless' startOpened={true}>
                {formFeatures[uClass.name]?.available?.length > 0 &&
                  formFeatures[uClass.name]?.available?.map((availableFeature: any, featureIndex: number) => {
                    const feature = availableFeature.feature
                    if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideInBuilder')) {
                      return (
                        <Collapse
                          key={featureIndex}
                          className={sprinkles({ mb: 'size-3' })}
                          title={`(${availableFeature.level}) ${feature.value}`}
                        >
                          <ScrollArea scrollDirection='horizontal' className={feature_card_body}>
                            {feature.desc && parse(feature.desc)}
                            {sectionNames.map((sectionName: SectionName, nameIndex: number) => (
                              <Fragment key={nameIndex}>
                                {feature[sectionName]?.length > 0 &&
                                  feature[sectionName].map((section: any) => {
                                    if (
                                      section.attribute?.some(
                                        (attributeItem: any) => attributeItem.name === 'providesOptions'
                                      )
                                    ) {
                                      // Check if selectionCount exists and is greater than 0
                                      const selectionCount = section.selectionCount || 1

                                      // Repeat Dropdown component based on selectionCount
                                      const dropdowns = Array.from({ length: selectionCount }, (_, index) => {
                                        // used to set the section option index selected on the form state
                                        let sectionIndex: number = 0

                                        // used to set the path to find and set the section option selected by user
                                        let pathName = ''

                                        // set the options for dropdown
                                        let options: any[] = []

                                        const categoryName = section.category?.name

                                        const optionIndex = index + featureIndex

                                        if (categoryName) {
                                          //eslint-disable-next-line
                                          const { _id: _, type, ...sectionFields } = section[categoryName]

                                          pathName += `${sectionName}.${categoryName}`

                                          sectionIndex =
                                            formState[sectionName]?.[categoryName]?.length > 0
                                              ? formState[sectionName]?.[categoryName]?.length
                                              : 0

                                          if (type.some((section: any) => section.name === 'all')) {
                                            if (builders && builders[categoryName]?.type) {
                                              options = builders[categoryName].type.map((typeItem: any) => {
                                                return {
                                                  ...typeItem,
                                                  ...sectionFields,
                                                  classId: uClass._id,
                                                  featureId: feature._id,
                                                  optionIndex: optionIndex,
                                                }
                                              })
                                            }
                                          } else {
                                            options = type.map((typeItem: any) => {
                                              return {
                                                ...typeItem,
                                                ...sectionFields,
                                                classId: uClass._id,
                                                featureId: feature._id,
                                                optionIndex: optionIndex,
                                              }
                                            })
                                          }

                                          if (categoryName === 'ability') {
                                            options = options.filter((option: any) => option.name !== 'spellAbility')
                                          }
                                        } else {
                                          sectionIndex =
                                            formState[sectionName]?.length > 0 ? formState[sectionName]?.length : 0

                                          options = section?.type.map((typeItem: any) => {
                                            return {
                                              ...typeItem,
                                              classId: uClass._id,
                                              featureId: feature._id,
                                              optionIndex: optionIndex,
                                            }
                                          })

                                          pathName += `${sectionName}`
                                        }

                                        let label = ''
                                        if (section.category?.length === 1) {
                                          label = section?.category[0]?.value
                                        } else {
                                          label = section?.category?.value
                                        }

                                        const inputPathName = pathName + `.${sectionIndex}`

                                        const existArray = get(formState, `${pathName}`)?.filter(
                                          (formOption: any) =>
                                            formOption.featureId === feature._id &&
                                            options?.some((option: any) => formOption?._id === option._id)
                                        )

                                        const exist = existArray.find(
                                          (formOption: any) => formOption.optionIndex === optionIndex
                                        )

                                        // Render the Dropdown component inside the loop
                                        return (
                                          <Dropdown
                                            key={index}
                                            name={`${inputPathName}`}
                                            className={sprinkles({
                                              mx: 'size-15',
                                              width: 'auto',
                                            })}
                                            label={`${label} Option`}
                                            options={options}
                                            optionalKey={['classId', 'featureId', 'optionIndex']}
                                            onChange={setFormState}
                                            value={exist}
                                          />
                                        )
                                      })

                                      return dropdowns
                                    }
                                  })}
                              </Fragment>
                            ))}
                          </ScrollArea>
                        </Collapse>
                      )
                    }
                  })}
                {formFeatures[uClass.name]?.unavailable?.length > 0 && (
                  <Collapse
                    title={`Available at Higher Levels (${formFeatures[uClass.name]?.unavailable?.length})`}
                    style='borderless'
                  >
                    {formFeatures[uClass.name]?.unavailable?.map((unavailableFeature: any, featureIndex: number) => {
                      const feature = unavailableFeature.feature
                      if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideInBuilder')) {
                        return (
                          <Collapse key={featureIndex} className={sprinkles({ mb: 'size-3' })} title={feature.value}>
                            <ScrollArea scrollDirection='horizontal' className={feature_card_body}>
                              {feature.desc && parse(feature.desc)}
                            </ScrollArea>
                          </Collapse>
                        )
                      }
                    })}
                  </Collapse>
                )}
              </Collapse>
            </Fragment>
          )
        })}
    </ScrollArea>
  )
}

export default ClassFeatureFormTest
