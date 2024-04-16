import parse from 'html-react-parser'
import { Fragment, useEffect, useState } from 'react'
import { getSectionNames } from '../../utils/formUtils'
import { ReducerActionType, SectionName } from '../../utils/types'
import Dropdown from '../Dropdown/Dropdown'
import ScrollCategory from '../ScrollArea/ScrollArea'
import { get, isEqual } from 'lodash'
import { sprinkles } from '../../css/sprinkles.css'
import { feature_card, feature_card_body, feature_card_header } from './Form.css'

interface RaceFeatureFormProps {
  selectedRace: any
  setFormState: (arg: ReducerActionType) => void
  formState: any
  races: any
}

const RaceFeatureForm = ({ formState, selectedRace, setFormState, races }: RaceFeatureFormProps) => {
  const [initialRace, setInitialRace] = useState<any>(null)
  const [formFeatures, setFormFeatures] = useState<any[]>([])

  const sectionNames = getSectionNames()

  // Set initial race for comparison later
  useEffect(() => {
    if (selectedRace && initialRace === null) {
      setInitialRace(selectedRace)
    }
  }, [selectedRace, initialRace])

  // Set initial race
  useEffect(() => {
    if (!formState.race && selectedRace) {
      setFormState({
        target: {
          name: 'race',
          value: { name: selectedRace?.name, value: selectedRace?.value, _id: selectedRace?._id },
        },
      })
    }
  }, [formState.race, selectedRace, setFormState])

  // Set/Remove Race Features
  useEffect(() => {
    let formClone = JSON.parse(JSON.stringify(formState))

    if (formClone.race) {
      const cloneFeatures: any[] = []
      const formFeatureClone: any[] = []
      if (selectedRace.lineage?.length > 0) {
        selectedRace.lineage?.forEach((lineage: any) => {
          const lineageRace = races.find((race: any) => race._id === lineage._id)
          if (lineageRace.feature?.length > 0) {
            lineageRace.feature?.map((feature: any) => {
              if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideOnSheet')) {
                cloneFeatures.push({
                  name: feature.name,
                  value: feature.value,
                  _id: feature._id,
                  raceId: lineageRace._id,
                })
              }
              formFeatureClone.push({ ...feature, raceId: lineageRace._id })
            })
          }
        })
      }
      if (selectedRace.feature?.length > 0) {
        selectedRace.feature?.map((feature: any) => {
          if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideOnSheet')) {
            cloneFeatures.push({
              name: feature.name,
              value: feature.value,
              _id: feature._id,
              raceId: selectedRace._id,
            })
          }
          formFeatureClone.push({ ...feature, raceId: selectedRace._id })
        })
      }
      if (formClone.feature?.length > 0) {
        formClone.feature?.forEach((feature: any) => {
          if (feature.raceId == null) {
            cloneFeatures.push(feature)
            formFeatureClone.push(feature)
          }
        })
      }
      if (!(cloneFeatures?.length > 0) && formClone.feature?.length > 0) {
        setFormState({
          type: 'removed',
          target: { name: 'feature' },
        })

        setFormFeatures([])
      } else if (!isEqual(cloneFeatures, formClone.feature) && cloneFeatures?.length > 0) {
        formClone = { ...formClone, feature: cloneFeatures }

        setFormState({
          target: {
            name: 'feature',
            value: get(formClone, 'feature'),
          },
        })
      }
      setFormFeatures(formFeatureClone)
    }
  }, [selectedRace, races, formState, setFormState])

  // Set/Remove Ancestry and Ancestry Features
  useEffect(() => {
    let formClone = JSON.parse(JSON.stringify(formState))

    if (formClone?.ancestry) {
      const formFeatureClone: any[] = []
      const ancestryFeatures: any[] = []
      if (selectedRace.ancestry?.option?.length > 0) {
        selectedRace.ancestry?.option
          ?.find((option: any) => option._id === formClone.ancestry._id)
          ?.feature.forEach((feature: any) => {
            if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideOnSheet')) {
              ancestryFeatures.push({
                name: feature.name,
                value: feature.value,
                _id: feature._id,
                ancestryId: feature._id,
              })
            }
            formFeatureClone.push({ ...feature, ancestryId: feature._id })
          })

        if (ancestryFeatures?.length > 0) {
          if (formClone.feature?.length > 0) {
            const cloneFeatures = formClone.feature?.filter((feature: any) => feature.ancestryId == null)
            ancestryFeatures.map((feature: any) => {
              cloneFeatures.push(feature)
              formFeatureClone.push(feature)
            })

            if (!isEqual(formClone.feature, cloneFeatures)) {
              formClone = { ...formClone, feature: [...cloneFeatures] }

              setFormState({
                target: { name: 'feature', value: get(formClone, 'feature') },
              })
            }
          } else {
            formClone = { ...formClone, feature: [...ancestryFeatures] }

            setFormState({
              target: { name: 'feature', value: get(formClone, 'feature') },
            })
          }

          setFormFeatures(ancestryFeatures)
        }
      } else {
        setFormState({
          type: 'removed',
          target: { name: 'ancestry' },
        })

        setFormFeatures([])
      }
    }
  }, [formState, sectionNames, setFormState, races, selectedRace])

  // Update sections from features
  useEffect(() => {
    const formClone = JSON.parse(JSON.stringify(formState))
    sectionNames.forEach((sectionName: any) => {
      if (sectionName !== 'feature' && sectionName !== 'option') {
        let sectionObject: any = {}
        const cloneSectionObject: any = get(formClone, `${sectionName}`)
        if (selectedRace.lineage?.length > 0) {
          selectedRace.lineage?.forEach((lineage: any) => {
            const lineageRace = races.find((race: any) => race._id === lineage._id)
            if (lineageRace.feature?.length > 0) {
              lineageRace.feature?.forEach((feature: any) => {
                if (feature[sectionName]?.length > 0) {
                  feature[sectionName].forEach((section: any) => {
                    const sectionArray: any[] = []
                    let pathName = ''

                    if (section.category?.name) {
                      pathName += `${sectionName}.${section.category.name}`
                    } else {
                      pathName += `${sectionName}`
                    }

                    const cloneArray = get(formClone, pathName)

                    if (cloneArray?.length > 0) {
                      cloneArray?.forEach((section: any) => {
                        if (section.raceId == null) {
                          sectionArray.push(section)
                        }
                      })
                    }

                    if (section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
                      const optionClone = get(formClone, pathName)?.find((sectionClone: any) => {
                        if (section.category?.name) {
                          return section[section.category?.name]?.type?.some(
                            (section: any) => section._id === sectionClone._id
                          )
                        } else {
                          return section?.type?.some((section: any) => section._id === sectionClone._id)
                        }
                      })

                      if (optionClone) {
                        if (section.category?.name) {
                          sectionObject = {
                            ...sectionObject,
                            [section.category?.name]: [...sectionObject[section.category?.name], { ...optionClone }],
                          }
                        } else {
                          sectionObject = [...sectionObject, { ...optionClone }]
                        }
                      }
                    }

                    if (!section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
                      if (section.category?.name) {
                        const categoryName = section.category?.name

                        if (section[categoryName]?.type?.length > 0) {
                          if (sectionObject[categoryName]?.type?.length > 0) {
                            const existArray = sectionObject[categoryName]?.type
                            sectionArray.push(...existArray)
                          }
                          section[categoryName]?.type?.map((type: any) => {
                            let typeObject: any = { ...type, raceId: lineageRace._id, featureId: feature._id }

                            if (section[categoryName]?.method) {
                              typeObject = { ...typeObject, method: section[categoryName]?.method }
                            }
                            if (section[categoryName]?.mode) {
                              typeObject = { ...typeObject, mode: section[categoryName]?.mode }
                            }
                            if (section[categoryName]?.level) {
                              typeObject = { ...typeObject, level: section[categoryName]?.level }
                            }

                            sectionArray.push(typeObject)
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
                          const typeObject: any = { ...type, raceId: selectedRace._id, featureId: feature._id }

                          sectionArray.push(typeObject)
                        })

                        if (sectionArray?.length > 0) {
                          sectionObject = [...sectionArray]
                        }
                      }
                    }
                  })
                }
              })
            }
          })
        }
        if (selectedRace.feature?.length > 0) {
          selectedRace.feature?.forEach((feature: any) => {
            if (feature[sectionName]?.length > 0) {
              feature[sectionName].forEach((section: any) => {
                const sectionArray: any[] = []
                let pathName = ''

                if (section.category?.name) {
                  pathName += `${sectionName}.${section.category.name}`
                } else {
                  pathName += `${sectionName}`
                }

                const cloneArray = get(formClone, pathName)

                if (cloneArray?.length > 0) {
                  cloneArray?.forEach((section: any) => {
                    if (section.raceId == null) {
                      sectionArray.push(section)
                    }
                  })
                }

                if (section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
                  console.log({ pathName })
                  const optionClone = get(formClone, pathName)?.find((sectionClone: any) => {
                    if (section.category?.name) {
                      return section[section.category?.name]?.type?.some(
                        (section: any) => section._id === sectionClone._id
                      )
                    } else {
                      return section?.type?.some((section: any) => section._id === sectionClone._id)
                    }
                  })

                  if (optionClone) {
                    if (section.category?.name) {
                      sectionObject = {
                        ...sectionObject,
                        [section.category?.name]: [...sectionObject[section.category?.name], { ...optionClone }],
                      }
                    } else {
                      sectionObject = [...sectionObject, { ...optionClone }]
                    }
                  }
                }

                if (!section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
                  if (section.category?.name) {
                    const categoryName = section.category?.name

                    if (section[categoryName]?.type?.length > 0) {
                      if (sectionObject[categoryName]?.type?.length > 0) {
                        const existArray = sectionObject[categoryName]?.type
                        sectionArray.push(...existArray)
                      }
                      section[categoryName]?.type?.map((type: any) => {
                        let typeObject: any = { ...type, raceId: selectedRace._id, featureId: feature._id }

                        if (section[categoryName]?.method) {
                          typeObject = { ...typeObject, method: section[categoryName]?.method }
                        }
                        if (section[categoryName]?.mode) {
                          typeObject = { ...typeObject, mode: section[categoryName]?.mode }
                        }
                        if (section[categoryName]?.level) {
                          typeObject = { ...typeObject, level: section[categoryName]?.level }
                        }

                        sectionArray.push(typeObject)
                      })

                      if (sectionArray?.length > 0) {
                        sectionObject = { ...sectionObject, [categoryName]: [...sectionArray] }
                      }
                    }
                  }
                  if (section.type?.length > 0) {
                    if (sectionObject?.type?.length > 0) {
                      const existArray = sectionObject?.type
                      sectionArray.push(...existArray)
                    }
                    section?.type?.map((type: any) => {
                      const typeObject: any = { ...type, raceId: selectedRace._id, featureId: feature._id }

                      sectionArray.push(typeObject)
                    })

                    if (sectionArray?.length > 0) {
                      sectionObject = [...sectionArray]
                    }
                  }
                }
              })
            }
          })
        }
        if (selectedRace.ancestry?.option?.length > 0) {
          const ancestryOption = selectedRace.ancestry?.option?.find(
            (option: any) => option._id === formClone?.ancestry?._id
          )
          if (ancestryOption?.[sectionName]?.length > 0) {
            ancestryOption[sectionName].forEach((section: any) => {
              const sectionArray: any[] = []
              let pathName = ''

              if (section.category?.name) {
                pathName += `${sectionName}.${section.category.name}`
              } else {
                pathName += `${sectionName}`
              }

              const cloneArray = get(formClone, pathName)

              if (cloneArray?.length > 0) {
                cloneArray?.forEach((section: any) => {
                  if (section.ancestryId == null) {
                    sectionArray.push(section)
                  }
                })
              }

              if (section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
                console.log({ pathName })
                const optionClone = get(formClone, pathName)?.find((sectionClone: any) => {
                  if (section.category?.name) {
                    return section[section.category?.name]?.type?.some(
                      (section: any) => section._id === sectionClone._id
                    )
                  } else {
                    return section?.type?.some((section: any) => section._id === sectionClone._id)
                  }
                })

                if (optionClone) {
                  if (section.category?.name) {
                    sectionObject = {
                      ...sectionObject,
                      [section.category?.name]: [...sectionObject[section.category?.name], { ...optionClone }],
                    }
                  } else {
                    sectionObject = [...sectionObject, { ...optionClone }]
                  }
                }
              }

              if (!section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
                if (section.category?.name) {
                  const categoryName = section.category?.name

                  if (section[categoryName]?.type?.length > 0) {
                    if (sectionObject[categoryName]?.type?.length > 0) {
                      const existArray = sectionObject[categoryName]?.type
                      sectionArray.push(...existArray)
                    }
                    section[categoryName]?.type?.map((type: any) => {
                      let typeObject: any = { ...type, raceId: selectedRace._id, ancestryId: ancestryOption._id }

                      if (section[categoryName]?.method) {
                        typeObject = { ...typeObject, method: section[categoryName]?.method }
                      }
                      if (section[categoryName]?.mode) {
                        typeObject = { ...typeObject, mode: section[categoryName]?.mode }
                      }
                      if (section[categoryName]?.level) {
                        typeObject = { ...typeObject, level: section[categoryName]?.level }
                      }

                      sectionArray.push(typeObject)
                    })

                    if (sectionArray?.length > 0) {
                      sectionObject = { ...sectionObject, [categoryName]: [...sectionArray] }
                    }
                  }
                }
                if (section.type?.length > 0) {
                  if (sectionObject?.type?.length > 0) {
                    const existArray = sectionObject?.type
                    sectionArray.push(...existArray)
                  }
                  section?.type?.map((type: any) => {
                    const typeObject: any = { ...type, raceId: selectedRace._id, ancestryId: ancestryOption._id }

                    sectionArray.push(typeObject)
                  })

                  if (sectionArray?.length > 0) {
                    sectionObject = [...sectionArray]
                  }
                }
              }
            })
          }
        }

        if (Object.keys(sectionObject).length > 0) {
          if (!isEqual(sectionObject, cloneSectionObject)) {
            console.log({ sectionObject, cloneSectionObject })
            setFormState({
              target: { name: `${sectionName}`, value: sectionObject },
            })
          }
        }
      }
    })
  }, [formFeatures, sectionNames, setFormState, formState, races, selectedRace])

  return (
    <ScrollCategory scrollDirection='vertical'>
      {selectedRace?.ancestry?.option?.length > 0 && (
        <div className={feature_card}>
          <div className={feature_card_header}>
            <h2>{selectedRace?.ancestry.value}</h2>
          </div>
          <div className={feature_card_body}>
            {selectedRace?.ancestry.desc && parse(selectedRace?.ancestry.desc)}
            <Dropdown
              name='ancestry'
              className={sprinkles({ mx: 'size-15', width: 'auto' })}
              label='Ancestry Option'
              options={selectedRace?.ancestry.option}
              optionalKey={'desc'}
              onChange={setFormState}
              value={formState.ancestry}
            />
            {formState?.ancestry && (
              <div
                className={sprinkles({
                  mt: 'size-3',
                  mx: 'size-15',
                  width: 'auto',
                })}
              >
                <strong>{formState.ancestry.desc && parse(formState.ancestry.desc)}</strong>
              </div>
            )}
          </div>
        </div>
      )}
      {formFeatures?.length > 0 &&
        formFeatures
          ?.sort((a: any, b: any) => a.value.localeCompare(b.value))
          .map((feature: any, featureIndex: number) => {
            if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideInBuilder')) {
              return (
                <div key={featureIndex} className={feature_card}>
                  <div className={feature_card_header}>
                    <h3>{feature.value}</h3>
                  </div>
                  <div className={feature_card_body}>
                    {feature.desc && parse(feature.desc)}
                    {sectionNames.map((sectionName: SectionName, nameIndex: number) => (
                      <Fragment key={nameIndex}>
                        {feature[sectionName]?.length > 0 &&
                          feature[sectionName].map((section: any, sectionIndex: number) => {
                            if (
                              section.attribute?.some((attributeItem: any) => attributeItem.name === 'providesOptions')
                            ) {
                              let sectionArray: any[] = []
                              let optionIndex
                              let pathName = ''

                              if (section.category?.name) {
                                const categoryName = section?.category?.name
                                sectionArray = section[categoryName]?.type

                                pathName += `${sectionName}.${categoryName}`

                                optionIndex =
                                  formState[sectionName]?.[categoryName]?.length > 0
                                    ? formState[sectionName]?.[categoryName]?.length
                                    : 0
                              } else {
                                sectionArray = section?.type

                                optionIndex = formState[sectionName]?.length > 0 ? formState[sectionName]?.length : 0

                                pathName += `${sectionName}`
                              }

                              let label = ''
                              if (section.category?.length === 1) {
                                label = section?.category[0]?.value
                              } else {
                                label = section?.category?.value
                              }

                              return (
                                <Fragment key={sectionIndex}>
                                  <Dropdown
                                    name={`${pathName}.${optionIndex}`}
                                    className={sprinkles({
                                      mx: 'size-15',
                                      width: 'auto',
                                    })}
                                    label={`${label} Option`}
                                    options={sectionArray.map((type: any) => ({
                                      ...type,
                                      raceId: feature.raceId,
                                      featureId: feature._id,
                                    }))}
                                    optionalKey={['raceId', 'featureId']}
                                    onChange={setFormState}
                                    value={get(formState, `${pathName}`)?.find((option: any) =>
                                      sectionArray?.some((section: any) => option?._id === section._id)
                                    )}
                                  />
                                </Fragment>
                              )
                            }
                          })}
                      </Fragment>
                    ))}
                  </div>
                </div>
              )
            }
          })}
    </ScrollCategory>
  )
}

export default RaceFeatureForm
