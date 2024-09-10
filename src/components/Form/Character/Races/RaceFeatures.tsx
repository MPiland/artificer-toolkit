import parse from 'html-react-parser'
import { Fragment, useCallback, useEffect, useMemo } from 'react'
import Dropdown from '../../../Dropdown/Dropdown'
import { get, isEqual, set } from 'lodash'
import { sprinkles } from '../../../../css/sprinkles.css'
import { feature_card, feature_card_body, feature_card_header } from '../Character.css'
import { option_dropdown } from '../Character.css'
import ScrollArea from '../../../ScrollArea/ScrollArea'
import Collapse from '../../../Collapse/Collapse'
import { useForm } from '../../../../hooks/UseForm'
import { getSectionOptions, sectionData } from '../../../../utils/form'
import { useFeature } from '../../../../hooks/UseFeature'
import { useGetBuildersQuery } from '../../../../features/systems/systemsApi'
import { useGetSpellsQuery } from '../../../../features/spells/spellsApi'
import { useGetFeatsQuery } from '../../../../features/feats/featsApi'
import { useGetRacesQuery } from '../../../../features/races/racesApi'

const RaceFeatures = ({ race }: { race: any }) => {
  const { formState, setFormState } = useForm()

  const { sectionNames } = useFeature()

  const { data: builders } = useGetBuildersQuery()
  const { data: spells } = useGetSpellsQuery() as { data: any[] }
  const { data: feats } = useGetFeatsQuery() as { data: any[] }
  const { data: races } = useGetRacesQuery() as { data: any[] }

  const fullRace = races.find((race: any) => race._id === formState.race._id)

  const ancestry: any = formState.ancestry
    ? fullRace?.ancestry?.options?.find((option: any) => option._id === formState?.ancestry?._id)
    : null

  const setFormRaces = useCallback((): { race: any; type: 'race' | 'ancestry' }[] => {
    const racesArray: any[] = []
    if (race) {
      if (!racesArray.some((formRace: any) => formRace.race._id === race._id)) {
        racesArray.push({ race: race, type: 'race' })
      }
      if (fullRace?.lineage?.length > 0) {
        fullRace?.lineage?.forEach((lineage: any) => {
          const lineageRace = races.find((stateRace: any) => stateRace._id === lineage._id)
          if (!racesArray.some((formRace: any) => formRace.race._id === lineageRace._id)) {
            racesArray.push({ race: lineageRace, type: 'race' })
          }
        })
      }
      if (ancestry) {
        if (!racesArray.some((formRace: any) => formRace.race._id === ancestry._id)) {
          racesArray.push({ race: ancestry, type: 'ancestry' })
        }
      }
    }

    return racesArray
  }, [races, ancestry, fullRace, race])

  const formRaces = useMemo(() => setFormRaces(), [setFormRaces])

  const createFeatures = useCallback((): any[] => {
    const featureArrayUpdated: any[] = []

    formRaces.forEach((raceObject) => {
      /* Whether the feature is a lineage or base race, match it to the base race selected.
      If it's an ancestry, match it to itself based on the state */
      const featureRace: any = raceObject.type === 'ancestry' ? ancestry : race

      // Default full features based off the raceObject
      let fullFeatures: any[] = races.find((fRace: any) => fRace._id === raceObject.race._id)?.features

      if (raceObject.type === 'ancestry') {
        // Use formstate race to get the ancestry options and then find the option based on the selected ancestry race
        fullFeatures = ancestry.features
      }

      /* Inject feature into array based off type
      If lineage or base, use base race Id
      If ancestry, use the ancestry Id
      This will allow for removing erroneous features using unique identifiers */
      fullFeatures?.forEach((feature: any) => {
        if (!featureArrayUpdated.some((aFeature: any) => aFeature._id === feature._id)) {
          featureArrayUpdated.push({ ...feature, [`${raceObject.type}Id`]: featureRace._id })
        }
      })
    })

    featureArrayUpdated.sort((a, b) => a.value.localeCompare(b.value))

    return featureArrayUpdated
  }, [races, formRaces, ancestry, race])

  const features = useMemo(() => createFeatures(), [createFeatures])

  const createRaceData = useCallback(() => {
    const formStateUpdated: any = JSON.parse(JSON.stringify(formState))

    if (features && features?.length > 0) {
      features?.forEach((feature) => {
        const sectionRace = feature.ancestryId != null ? ancestry : race
        sectionNames.forEach((sectionName) => {
          if (sectionName !== 'features' && sectionName !== 'options' && sectionName !== 'ancestry') {
            let sectionObject: any = {}
            const sectionClone: any = get(formStateUpdated, `${sectionName}`)
            if (sectionClone) {
              if (!Array.isArray(sectionClone) && Object.keys(sectionClone)?.length > 0) {
                Object.keys(sectionClone).forEach((key: string) => {
                  const section = sectionClone[key]
                  if (Array.isArray(section) && section?.length > 0) {
                    section.forEach((sectionItem: any) => {
                      if (
                        (sectionItem.raceId == null ||
                          formRaces.some((raceObject) => raceObject.race._id === sectionItem.raceId)) &&
                        (sectionItem.ancestryId == null || formState.ancestry._id === sectionItem.ancestryId)
                      ) {
                        if (sectionObject[key]?.length > 0) {
                          const exist = get(sectionObject, key)
                          exist.push(sectionItem)
                          set(sectionObject, key, exist)
                        } else {
                          set(sectionObject, key, [{ ...sectionItem }])
                        }
                      }
                    })
                  }
                })
              }
              if (Array.isArray(sectionClone) && sectionClone.length > 0) {
                sectionClone.forEach((section: any) => {
                  if (
                    (section.raceId == null ||
                      formRaces.some((raceObject) => raceObject.race._id === section.raceId)) &&
                    (section.ancestryId == null || ancestry._id === section.ancestryId)
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
                if (!section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
                  sectionObject = sectionData({
                    section,
                    sectionObject,
                    item: sectionRace,
                    itemType: 'race',
                    feature,
                    builders,
                  })
                }
              })
            }
            if (sectionRace[sectionName]?.length > 0) {
              sectionRace[sectionName].forEach((section: any) => {
                if (!section.attribute?.some((attribute: any) => attribute.name === 'providesOptions')) {
                  sectionObject = sectionData({
                    section,
                    sectionObject,
                    item: sectionRace,
                    itemType: 'race',
                    feature,
                    builders,
                  })
                }
              })
            }
            if (sectionName === 'spells' || sectionName === 'feats') {
              if (!Array.isArray(sectionObject) && Object.keys(sectionObject).length === 0) {
                sectionObject = []
              }
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

    return formStateUpdated
  }, [features, formState, builders, sectionNames, formRaces, ancestry, race])

  // Memoize the feature sections
  const formStateUpdated = useMemo(() => createRaceData(), [createRaceData])

  // Update state sections
  useEffect(() => {
    if (!isEqual(formState, formStateUpdated)) {
      setFormState({
        type: 'reset',
        target: {
          value: formStateUpdated,
        },
      })
    }
  }, [formState, setFormState, formStateUpdated])

  // Update race features
  useEffect(() => {
    const formClone = JSON.parse(JSON.stringify(formState))

    features?.forEach((feature) => {
      if (feature.ancestryId) {
        const ancestryFeatures = get(formClone, 'ancestry.features') ?? []
        if (!ancestryFeatures.some((aFeature: any) => aFeature._id === feature._id)) {
          ancestryFeatures.push(feature)
          set(formClone, 'ancestry.features', ancestryFeatures)
        }
      }
      if (feature.raceId) {
        const raceFeatures = get(formClone, 'race.features') ?? []
        if (!raceFeatures.some((aFeature: any) => aFeature._id === feature._id)) {
          raceFeatures.push(feature)
          set(formClone, 'race.features', raceFeatures)
        }
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
  }, [features, formState, setFormState])

  return (
    <>
      {formState.race?.lineage?.length > 0 &&
        formState.race?.lineage?.forEach(
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
                      name={`ancestry`}
                      label='Ancestry Option'
                      options={lineage?.ancestry.option.map((option: any) => ({
                        name: option.name,
                        value: option.value,
                        desc: option.desc,
                        _id: option._id,
                        raceId: lineage._id,
                      }))}
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
      {fullRace.ancestry?.options?.length > 0 && (
        <div className={feature_card}>
          <div className={feature_card_header}>
            <h2>{fullRace.ancestry.value}</h2>
          </div>
          <ScrollArea scrollDirection='horizontal' className={feature_card_body}>
            {fullRace.ancestry.desc && parse(fullRace.ancestry.desc)}
            <div className={option_dropdown}>
              <Dropdown
                name='ancestry'
                label='Ancestry Option'
                options={fullRace.ancestry.options.map((option: any) => ({
                  name: option.name,
                  value: option.value,
                  _id: option._id,
                  desc: option.desc,
                }))}
                onChange={setFormState}
                value={formState.ancestry}
              />
              {formState?.ancestry && <strong>{formState.ancestry.desc && parse(formState.ancestry.desc)}</strong>}
            </div>
          </ScrollArea>
        </div>
      )}
      {features &&
        features?.length > 0 &&
        features?.map((feature: any, featureIndex: number) => {
          if (!feature.attribute?.some((attribute: any) => attribute.name === 'hideInBuilder')) {
            return (
              <Collapse key={featureIndex}>
                <Collapse.Header title={feature.value} className={feature_card_header} />
                <Collapse.Body>
                  <ScrollArea scrollDirection='horizontal' className={feature_card_body}>
                    {feature.desc && parse(feature.desc)}
                    {sectionNames.map((sectionName, nameIndex: number) => (
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
                                const optionIndex = `${index}` + `${featureIndex}`

                                const { options, label, inputPathName, exist } = getSectionOptions({
                                  section,
                                  sectionName,
                                  feature,
                                  optionIndex,
                                  state: formState,
                                  builders,
                                  feats,
                                  spells,
                                  featureType: 'race',
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
                                    label={`${label} Option`}
                                    options={options}
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
                </Collapse.Body>
              </Collapse>
            )
          }
        })}
    </>
  )
}

export default RaceFeatures
