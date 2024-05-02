import parse from 'html-react-parser'
import { Fragment, useContext, useEffect, useState } from 'react'
import { getSectionNames } from '../../../utils/formUtils'
import { SectionName } from '../../../utils/types'
import Dropdown from '../../Dropdown/Dropdown'
import { get, isEqual, set } from 'lodash'
import { sprinkles } from '../../../css/sprinkles.css'
import { feature_card, feature_card_body, feature_card_header } from './Character.css'
import { option_dropdown } from './Character.css'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { form_content } from '../Form.css'
import { useGetBuildersQuery } from '../../../features/builder/builderApiSlice'
import { selectAllRaces, useGetRacesQuery } from '../../../features/race/raceApiSlice'
import { FormStepsContext } from '../FormStepsContext'

const RaceFeatureFormTest = () => {
  const { formState, selectedRace, setFormState } = useContext(FormStepsContext)

  const [formRaces, setFormRaces] = useState<{ item: any; type: 'race' | 'ancestry' }[]>([])
  const [formFeatures, setFormFeatures] = useState<any[] | null>(null)

  const sectionNames = getSectionNames()

  const { data: builders } = useGetBuildersQuery(undefined)

  const { races }: { races: any } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data }) => ({ races: data && selectAllRaces(data) }),
  })

  // Set initial Race
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

  // Reset if change Race
  useEffect(() => {
    if (formState.race && selectedRace && selectedRace._id !== formState.race._id) {
      setFormState({
        target: {
          name: 'race',
          value: { name: selectedRace?.name, value: selectedRace?.value, _id: selectedRace?._id },
        },
      })

      if (!selectedRace.ancestry && formState.ancestry) {
        setFormState({
          type: 'removed',
          target: { name: 'ancestry' },
        })
      }
    }
  }, [selectedRace, formState.race, formState.ancestry, setFormState])

  // Set/Remove form races
  useEffect(() => {
    if (formState.race) {
      const race = races.find((race: any) => race._id === formState.race._id)
      const racesArray: any[] = []
      if (!racesArray.some((formRace: any) => formRace.item._id === race._id)) {
        racesArray.push({ item: race, type: 'race' })
      }
      if (race.lineage?.length > 0) {
        race.lineage?.forEach((lineage: any) => {
          const lineageRace = races.find((raceState: any) => raceState._id === lineage._id)
          if (!racesArray.some((formRace: any) => formRace.item._id === lineageRace._id)) {
            racesArray.push({ item: lineageRace, type: 'race' })
          }
        })
      }
      if (formState.ancestry) {
        const ancestryRace = races.find((race: any) => race._id === formState.race._id)
        if (ancestryRace.lineage?.length > 0) {
          race.lineage?.forEach((lineage: any) => {
            const lineageRace = races.find((race: any) => race._id === lineage._id)
            if (lineageRace.ancestry?.option?.length > 0) {
              const selectedAncestry = lineage.ancestry?.option?.find(
                (option: any) => option._id === formState?.ancestry?._id
              )
              if (selectedAncestry) {
                if (!racesArray.some((formRace: any) => formRace.item._id === selectedAncestry._id)) {
                  racesArray.push({ item: selectedAncestry, type: 'ancestry' })
                }
              }
            }
          })
        } else if (race.ancestry?.option?.length > 0) {
          const selectedAncestry = race.ancestry?.option?.find((option: any) => option._id === formState?.ancestry?._id)
          if (selectedAncestry) {
            if (!racesArray.some((formRace: any) => formRace.item._id === selectedAncestry._id)) {
              racesArray.push({ item: selectedAncestry, type: 'ancestry' })
            }
          }
        }
      }

      if (!isEqual(formRaces, racesArray)) {
        setFormRaces(racesArray)
      }
    }
  }, [formRaces, formState.ancestry, formState.race, races])

  // Set/Remove Race Features
  useEffect(() => {
    const sectionData = (section: any, sectionObject: any, raceType: string, formRace: any, feature?: any) => {
      const sectionArray: any[] = []
      const categoryName = section.category?.name

      if (!section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
        if (categoryName) {
          if (section[categoryName] != null && section[categoryName]?.type?.length > 0) {
            if (sectionObject[categoryName]?.length > 0) {
              const existArray = [...sectionObject[categoryName]]
              sectionArray.push(...existArray)
            }

            //eslint-disable-next-line
            const { _id, type, ...sectionFields } = section[categoryName]

            type?.forEach((type: any) => {
              if (!sectionArray.some((section: any) => section._id === type._id)) {
                let typeObject: any = { ...type, [`${raceType}Id`]: formRace._id, ...sectionFields }
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
          } else if (section[categoryName] != null) {
            if (sectionObject[categoryName]?.length > 0) {
              const existArray = [...sectionObject[categoryName]]
              sectionArray.push(...existArray)
            }

            if (
              !sectionArray.some(
                (arrayItem: any) =>
                  arrayItem._id === section[categoryName]?._id && arrayItem?.[`${raceType}Id`] === formRace._id
              )
            ) {
              let typeObject: any = { ...section[categoryName], [`${raceType}Id`]: formRace._id }
              if (feature) {
                typeObject = { ...typeObject, featureId: feature._id }
              }

              sectionArray.push(typeObject)
              if (sectionArray?.length > 0) {
                sectionObject = {
                  ...sectionObject,
                  [categoryName]: [...sectionArray],
                }
              }
            }
          }
        }
        if (section.type?.length > 0) {
          if (sectionObject?.length > 0) {
            const existArray = sectionObject
            sectionArray.push(...existArray)
          }
          section?.type?.map((type: any) => {
            if (!sectionArray.some((section: any) => section._id === type._id)) {
              const typeObject: any = { ...type, [`${raceType}Id`]: formRace._id, featureId: feature._id }

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

    const formClone = JSON.parse(JSON.stringify(formState))
    if (formState.race && formRaces.length > 0) {
      const featureArray: any[] = []
      const cloneArray: any[] = get(formClone, 'feature')
      if (cloneArray && cloneArray.length > 0) {
        cloneArray.forEach((feature: any) => {
          if ((feature.raceId == null || !feature.raceId) && (feature.ancestryId == null || !feature.ancestryId)) {
            if (
              (featureArray?.length > 0 && !featureArray.some((featureItem: any) => featureItem._id === feature._id)) ||
              !(featureArray.length > 0)
            ) {
              featureArray.push(feature)
            }
          }
        })
      }

      formRaces.forEach((raceObject: any) => {
        const formRace = raceObject.item
        const raceType = raceObject.type
        if (formRace.feature?.length > 0) {
          formRace.feature?.map((feature: any) => {
            if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideOnSheet')) {
              featureArray.push({
                name: feature.name,
                value: feature.value,
                _id: feature._id,
                [`${raceType}Id`]: formRace._id,
              })
            }
            if (!formFeatures?.some((formFeature: any) => formFeature._id === feature._id)) {
              const stateArray = [...(formFeatures ?? [])]
              stateArray.push({ ...feature, [`${raceType}Id`]: formRace._id })
              setFormFeatures(stateArray)
            }

            sectionNames.forEach((sectionName: string) => {
              if (sectionName !== 'feature' && sectionName !== 'option' && sectionName !== 'ancestry') {
                let sectionObject: any = {}
                const cloneObject: any = get(formState, `${sectionName}`)
                if (cloneObject) {
                  if (!Array.isArray(cloneObject) && Object.keys(cloneObject)?.length > 0) {
                    Object.keys(cloneObject).forEach((key: string) => {
                      const section = cloneObject[key]
                      if (Array.isArray(section) && section?.length > 0) {
                        section.forEach((sectionItem: any) => {
                          if (
                            (sectionItem.raceId == null ||
                              formRaces.some((formRace: any) => formRace.item._id === sectionItem.raceId)) &&
                            (sectionItem.ancestryId == null ||
                              formRaces.some((formRace: any) => formRace.item._id === sectionItem.ancestryId))
                          ) {
                            if (sectionObject[key]?.length > 0) {
                              sectionObject = { ...sectionObject, [key]: [...sectionObject[key], { ...sectionItem }] }
                            } else {
                              sectionObject = { ...sectionObject, [key]: [{ ...sectionItem }] }
                            }
                          }
                        })
                      }
                    })
                  }
                  if (Array.isArray(cloneObject) && cloneObject.length > 0) {
                    cloneObject.forEach((section: any) => {
                      if (
                        (section.raceId == null ||
                          formRaces.some((formRace: any) => formRace.item._id === section.raceId)) &&
                        (section.ancestryId == null ||
                          formRaces.some((formRace: any) => formRace.item._id === section.ancestryId))
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
                if (feature[sectionName]?.length > 0) {
                  feature[sectionName].forEach((section: any) => {
                    sectionObject = sectionData(section, sectionObject, raceType, formRace, feature)
                  })
                }
                if (formRace[sectionName]?.length > 0) {
                  formRace[sectionName].forEach((section: any) => {
                    sectionObject = sectionData(section, sectionObject, raceType, formRace)
                  })
                }
                if (!isEqual(sectionObject, cloneObject)) {
                  set(formClone, sectionName, sectionObject)
                }
              }
            })
            if (!isEqual(formClone, formState)) {
              setFormState({
                type: 'reset',
                target: { value: formClone },
              })
            }
          })
        }
      })

      if (!isEqual(featureArray, cloneArray)) {
        set(formClone, 'feature', featureArray)
      }

      if (!isEqual(formClone, formState)) {
        setFormState({
          type: 'reset',
          target: { value: formClone },
        })
      }
    }
  }, [selectedRace, races, formState, setFormState, formRaces, formFeatures, sectionNames])

  return (
    <ScrollArea scrollDirection='vertical' className={form_content}>
      {selectedRace.lineage?.length > 0 &&
        selectedRace.lineage?.forEach(
          (lineage: any, index: number) =>
            lineage?.ancestry?.option?.length > 0 && (
              <div className={feature_card} key={index}>
                <div className={feature_card_header}>
                  <h2>{lineage?.ancestry.value}</h2>
                </div>
                <div className={feature_card_body}>
                  {lineage?.ancestry.desc && parse(lineage?.ancestry.desc)}
                  <div className={option_dropdown}>
                    <Dropdown
                      name={`lineage.${index}.ancestry`}
                      label='Ancestry Option'
                      options={lineage?.ancestry.option.map((option: any) => ({
                        name: option.name,
                        value: option.value,
                        desc: option.desc,
                        _id: option._id,
                        raceId: lineage._id,
                      }))}
                      optionalKey={['desc', 'raceId']}
                      onChange={setFormState}
                      value={formState.ancestry}
                    />
                    {formState?.ancestry && (
                      <strong>{formState.ancestry.desc && parse(formState.ancestry.desc)}</strong>
                    )}
                  </div>
                </div>
              </div>
            )
        )}
      {selectedRace?.ancestry?.option?.length > 0 && (
        <div className={feature_card}>
          <div className={feature_card_header}>
            <h2>{selectedRace?.ancestry.value}</h2>
          </div>
          <ScrollArea scrollDirection='horizontal' className={feature_card_body}>
            {selectedRace?.ancestry.desc && parse(selectedRace?.ancestry.desc)}
            <div className={option_dropdown}>
              <Dropdown
                name='ancestry'
                label='Ancestry Option'
                options={selectedRace?.ancestry.option.map((option: any) => ({
                  name: option.name,
                  value: option.value,
                  desc: option.desc,
                  _id: option._id,
                  raceId: selectedRace._id,
                }))}
                optionalKey={['desc', 'raceId']}
                onChange={setFormState}
                value={formState.ancestry}
              />
              {formState?.ancestry && <strong>{formState.ancestry.desc && parse(formState.ancestry.desc)}</strong>}
            </div>
          </ScrollArea>
        </div>
      )}
      {formFeatures &&
        formFeatures?.length > 0 &&
        formFeatures
          ?.sort((a: any, b: any) => a.value.localeCompare(b.value))
          .map((feature: any, featureIndex: number) => {
            if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideInBuilder')) {
              return (
                <div key={featureIndex} className={feature_card}>
                  <div className={feature_card_header}>
                    <h3>{feature.value}</h3>
                  </div>
                  <ScrollArea scrollDirection='horizontal' className={feature_card_body}>
                    {feature.desc && parse(feature.desc)}
                    {sectionNames.map((sectionName: SectionName, nameIndex: number) => (
                      <Fragment key={nameIndex}>
                        {feature[sectionName]?.length > 0 &&
                          feature[sectionName].map((section: any) => {
                            if (
                              section.attribute?.some((attributeItem: any) => attributeItem.name === 'providesOptions')
                            ) {
                              // Check if selectionCount exists and is greater than 0
                              const selectionCount = section.selectionCount || 1

                              // Repeat Dropdown component based on selectionCount
                              const dropdowns = Array.from({ length: selectionCount }, (_, index) => {
                                // used to set the section option index selected on the form state
                                let sectionIndex

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
                                          raceId: feature.raceId,
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
                                        raceId: feature.raceId,
                                        featureId: feature._id,
                                        optionIndex: optionIndex,
                                      }
                                    })
                                  }

                                  if (categoryName === 'ability') {
                                    options = options.filter((option: any) => option.name !== 'spellAbility')
                                  }
                                } else {
                                  sectionIndex = formState[sectionName]?.length > 0 ? formState[sectionName]?.length : 0

                                  options = section?.type.map((typeItem: any) => {
                                    return {
                                      ...typeItem,
                                      raceId: feature.raceId,
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
                                    optionalKey={['raceId', 'featureId', 'optionIndex']}
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
                </div>
              )
            }
          })}
    </ScrollArea>
  )
}

export default RaceFeatureFormTest
