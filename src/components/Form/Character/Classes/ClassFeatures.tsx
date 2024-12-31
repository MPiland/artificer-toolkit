import { useCallback, useMemo, useEffect, Fragment, use } from 'react'
import { SectionDataType, SectionName, UpdateState } from '../../../../types/form'
import { isEqual } from 'lodash'
import Collapse from '../../../Collapse/Collapse'
import ScrollArea from '../../../ScrollArea/ScrollArea'
import Dropdown from '../../../Dropdown/Dropdown'
import { feature_card_header, option_dropdown } from '../Character.css'
import parse from 'html-react-parser'
import { sprinkles } from '../../../../css/sprinkles.css'
import { excludeFields } from '../../../../utils/form'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { useListClassesQuery } from '../../../../features/classes/classesApi'
import {
  Character,
  CharacterClass,
  CharacterFeat,
  CharacterModifier,
  CharacterProficiency,
  CharacterExpertise,
  CharacterSense,
  Class,
  Feature,
} from '../../../../../amplify/API'
import { Attributes, Categories } from '../../../../types/enums'
import FeatureContext from '../../Features/FeatureContext'
import useGetSections from '../../../../hooks/useGetSectionState'

export type FeatureObject = {
  level: number
  features: Array<
    Feature & { classId: string; raceId: string; backgroundId: string; featId: string; ancestryId: string }
  >
}

export type ClassFeatures = {
  available: Array<FeatureObject>
  unavailable: Array<FeatureObject>
}

const ClassFeature = ({
  uClass,
  classIndex,
  fullClass,
  formData,
  updateFormData,
}: {
  uClass: CharacterClass
  classIndex: number
  fullClass: Class
  formData: Character
  updateFormData: (state: UpdateState<Character>) => void
}) => {
  const { sectionSteps } = use(FeatureContext)
  const { data: system } = useGetSystemQuery()
  const { data: classes } = useListClassesQuery()

  const { getSectionOptions, getFeatureOptions } = useGetSections({ state: formData })

  // Create feauture array for the selected class
  const createFeatures = useCallback(() => {
    let subclassMapped: boolean = false

    let featureUpdated: ClassFeatures = { available: [], unavailable: [] }

    const createObject = (type?: 'subclass', featureObject?: ClassFeatures) => {
      if (featureObject && Object.keys(featureObject).length > 0) {
        featureUpdated = { ...featureObject }
      }

      const featureClass: Class =
        type === 'subclass' ? classes.find((fClass) => fClass.id === uClass.subclass.id) : fullClass

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

            if (Number(level) <= uClass.level) {
              const arrayIndex = featureUpdated.available?.findIndex((aFeature) => aFeature.level === Number(level))

              if (arrayIndex === -1) {
                featureUpdated.available.push({
                  level: Number(level),
                  features: [{ ...featureObjectClone }],
                })
              } else {
                const arrayObject = featureUpdated.available[arrayIndex]
                if (arrayObject && !arrayObject?.features.some((aFeature) => aFeature.id === feature.id)) {
                  featureUpdated.available[arrayIndex].features = [...arrayObject.features, { ...featureObjectClone }]
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
                if (arrayObject && !arrayObject?.features.some((aFeature) => aFeature.id === feature.id)) {
                  featureUpdated.unavailable[arrayIndex].features = [...arrayObject.features, { ...featureObjectClone }]
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
          fObject.features.sort((a, b) => a.value?.localeCompare(b.value))
          return fObject
        })
      featureUpdated.available = available
    }

    if (featureUpdated.unavailable.length > 0) {
      const unavailable = featureUpdated.unavailable
        .sort((a, b) => a.level - b.level)
        .map((fObject) => {
          fObject.features.sort((a, b) => a.value?.localeCompare(b.value))
          return fObject
        })
      featureUpdated.unavailable = unavailable
    }

    return featureUpdated
  }, [classes, uClass, fullClass])

  // Memoize the feature array
  const features = useMemo(() => createFeatures(), [createFeatures])

  // Create the different feature sections
  useEffect(() => {
    let subclassMapped: boolean = false
    let characterData: Character = JSON.parse(JSON.stringify(formData))

    // Create the data to store the sections into
    const sections: {
      feats: Array<CharacterFeat | null>
      modifiers: Array<CharacterModifier | null>
      proficiencies: Array<CharacterProficiency | null>
      expertise: Array<CharacterExpertise | null>
      senses: Array<CharacterSense | null>
    } = {
      feats: [],
      modifiers: [],
      proficiencies: [],
      expertise: [],
      senses: [],
    }

    // Store the current character sections for comparison at the end
    const characterSections = {
      feats: characterData.feats,
      modifiers: characterData.modifiers,
      proficiencies: characterData.proficiencies,
      expertise: characterData.expertise,
      senses: characterData.senses,
    }

    const createObject = (type?: 'subclass', dataSectionObject?: Character) => {
      if (dataSectionObject) {
        characterData = dataSectionObject
      }

      const sectionClass =
        type === 'subclass' ? classes?.find((classItem) => uClass.subclass.id === classItem.id) : fullClass

      if (features.available && features.available?.length > 0) {
        // Run through the features that are available
        features?.available?.forEach((featureObject) => {
          if (featureObject.features?.length > 0) {
            featureObject.features.forEach((feature) => {
              // Map through the different sections available for the character
              // Senses, Feats, Proficiencies, Expertise, Skills, Saveabilities
              sectionSteps.forEach((sectionStep) => {
                if (sectionStep !== 'spells' && sectionStep !== 'ancestries') {
                  if (Array.isArray(characterSections[sectionStep]) && characterSections[sectionStep].length > 0) {
                    characterSections[sectionStep].forEach((section) => {
                      if (
                        section.classId == null ||
                        characterData.classes.some((uClass) => uClass.id === section.classId)
                      ) {
                        if (sectionStep === 'feats') {
                          sections.feats.push({
                            ...section,
                            __typename: 'CharacterFeat',
                            featId: section.featId,
                          })
                        }
                        if (sectionStep === 'proficiencies') {
                          sections.proficiencies.push({
                            ...section,
                            __typename: 'CharacterProficiency',
                            proficiencyId: (section as CharacterProficiency).proficiencyId,
                          })
                        }
                        if (sectionStep === 'expertise') {
                          sections.expertise.push({
                            ...section,
                            __typename: 'CharacterExpertise',
                            expertiseId: (section as CharacterExpertise).expertiseId,
                          })
                        }
                        if (sectionStep === 'modifiers') {
                          sections.modifiers.push({
                            ...section,
                            __typename: 'CharacterModifier',
                            modifierId: (section as CharacterModifier).modifierId,
                          })
                        }
                        if (sectionStep === 'senses') {
                          sections.senses.push({
                            ...section,
                            __typename: 'CharacterSense',
                            senseId: (section as CharacterSense).senseId,
                          })
                        }
                      }
                    })
                  }
                  if (feature?.[sectionStep]?.length > 0) {
                    feature?.[sectionStep]?.forEach((fSection) => {
                      if (!fSection?.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
                        if (
                          !sections[sectionStep].find(
                            (section) =>
                              ((section.__typename === 'CharacterFeat' && section.featId === fSection.id) ||
                                (section.__typename === 'CharacterModifier' && section.modifierId === fSection.id) ||
                                (section.__typename === 'CharacterSense' && section.senseId === fSection.id) ||
                                (section.__typename === 'CharacterExpertise' && section.expertiseId === fSection.id) ||
                                (section.__typename === 'CharacterProficiency' &&
                                  section.proficiencyId === fSection.id)) &&
                              section.classId === sectionClass.id &&
                              section.featureId === feature.id
                          )
                        ) {
                          if (sectionStep === 'feats') {
                            sections.feats.push({
                              __typename: 'CharacterFeat',
                              featId: fSection.id,
                              featureId: feature.id,
                            })
                          }
                          if (sectionStep === 'proficiencies') {
                            sections.proficiencies.push({
                              __typename: 'CharacterProficiency',
                              proficiencyId: fSection.id,
                              featureId: feature.id,
                            })
                          }
                          if (sectionStep === 'expertise') {
                            sections.expertise.push({
                              __typename: 'CharacterExpertise',
                              expertiseId: fSection.id,
                              featureId: feature.id,
                            })
                          }
                          if (sectionStep === 'modifiers') {
                            sections.modifiers.push({
                              __typename: 'CharacterModifier',
                              modifierId: fSection.id,
                              featureId: feature.id,
                            })
                          }
                          if (sectionStep === 'senses') {
                            sections.senses.push({
                              __typename: 'CharacterSense',
                              senseId: fSection.id,
                              featureId: feature.id,
                            })
                          }
                        }
                      }
                    })
                  }
                  if (sectionClass?.proficiencies?.length > 0) {
                    sectionClass.proficiencies.forEach((cProficiency) => {
                      if (
                        !sections.proficiencies.find((proficiency) => proficiency.proficiencyId === cProficiency.id)
                      ) {
                        sections.proficiencies.push({
                          __typename: 'CharacterProficiency',
                          proficiencyId: cProficiency.id,
                          classId: sectionClass.id,
                        })
                      }
                    })
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
      createObject('subclass', characterData)
    }

    if (!isEqual(sections, characterSections)) {
      Object.keys(sections).forEach((key: keyof typeof sections) => {
        if (sections[key].length > 0) {
          characterData = {
            ...characterData,
            [key]: sections[key],
          }
        }
      })
      updateFormData({
        type: 'reset',
        value: characterData,
      })
    }
  }, [formData, sectionSteps, classes, uClass, features, system, fullClass, updateFormData])

  // Update class features
  useEffect(() => {
    const availableFeatures: Array<{ id: string; option?: string }> = features.available.flatMap((aObject) => {
      if (aObject.level <= uClass.level) {
        return aObject.features.map((feature) => ({
          id: feature.id,
          classId: uClass.id,
        }))
      }
    })
    if (!isEqual(availableFeatures, formData.features)) {
      updateFormData({
        type: 'update',
        path: `features`,
        value: availableFeatures,
      })
    }
  }, [updateFormData, formData.features, features.available, classIndex, uClass.level, uClass.id])

  const subClasses = classes.filter((uClass) => uClass?.parentClass === uClass.id)

  return features.available.flatMap((aObject) =>
    aObject.features.map((feature, fIndex) => {
      const featureLevel = aObject.level
      if (!feature.attributes?.some((attribute) => attribute === Attributes.hideOnSheet)) {
        return (
          <Collapse key={fIndex}>
            <Collapse.Header title={`(${featureLevel}) ${feature.value}`} className={feature_card_header} />
            <Collapse.Body>
              <ScrollArea scrollDirection='horizontal'>
                {feature.category === Categories.subclass && parse(feature?.detail)}
                {feature.desc && parse(feature.desc)}
                {feature.category === Categories.subclass && (
                  <>
                    <Dropdown
                      name={`classes.${classIndex}.subclass.id`}
                      className={sprinkles({
                        mx: 'space-15',
                        width: 'size-auto',
                      })}
                      label={'Subclass Option'}
                      options={subClasses}
                      onChange={updateFormData}
                      value={uClass.subclass.id}
                    />
                    {subClasses.find((sClass) => uClass.subclass?.id === sClass.id)?.subtypes?.length > 0 && (
                      <Dropdown
                        name={`classes.${classIndex}.subclass.subtype`}
                        className={sprinkles({
                          mx: 'space-15',
                          width: 'size-auto',
                        })}
                        label={'Subtype Option'}
                        options={subClasses.find((sClass) => uClass.subclass.id === sClass.id).subtypes}
                        onChange={updateFormData}
                        value={uClass.subclass.subtype}
                      />
                    )}
                  </>
                )}
                {!(feature?.options?.length > 0)
                  ? // If feature doesn't have options, then check for sections
                    sectionSteps.map((sectionStep: Exclude<SectionName, 'ancestries'>, nameIndex) => (
                      <Fragment key={nameIndex}>
                        {feature[sectionStep]?.length > 0 &&
                          feature[sectionStep].map((section) => {
                            if (section?.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
                              // Check if selectionCount exists and is greater than 0
                              const selectionCount = section?.selectionCount || 1

                              // Repeat Dropdown component based on selectionCount
                              const dropdowns = Array.from({ length: selectionCount }, (_, index) => {
                                const optionIndex = index & fIndex & classIndex

                                const { options, label, path, exist } = getSectionOptions({
                                  section,
                                  sectionStep,
                                  optionIndex,
                                })

                                return (
                                  <Dropdown
                                    key={index}
                                    name={path}
                                    className={sprinkles({
                                      mx: 'space-15',
                                      width: 'size-auto',
                                    })}
                                    label={`${label} Option`}
                                    options={options}
                                    onChange={() =>
                                      updateFormData({
                                        type: 'update',
                                        path: path,
                                        value: {
                                          option: exist,
                                          classId: uClass.id,
                                          optionIndex: optionIndex,
                                          featureId: feature.id,
                                        },
                                      })
                                    }
                                    value={exist}
                                  />
                                )
                              })

                              return dropdowns
                            }
                          })}
                      </Fragment>
                    ))
                  : (() => {
                      // If feature.options does have a length, provide the options for that
                      const selectionCount = feature?.selectionCount || 1

                      const dropdowns = Array.from({ length: selectionCount }, (_, index) => {
                        const optionIndex = index & fIndex & classIndex

                        const { path, exist } = getFeatureOptions({
                          options: feature.options,
                          optionIndex,
                        })

                        return (
                          <div className={option_dropdown} key={index}>
                            <Dropdown
                              name={path}
                              label={`${feature.value} Option`}
                              options={feature.options}
                              onChange={() =>
                                updateFormData({
                                  type: 'update',
                                  path: path,
                                  value: {
                                    option: exist.id,
                                    classId: uClass.id,
                                    optionIndex: optionIndex,
                                    id: feature.id,
                                  },
                                })
                              }
                              value={exist.id}
                            />
                            {exist?.desc && parse(exist.desc)}
                          </div>
                        )
                      })

                      return dropdowns
                    })()}
                {(() => {
                  if (feature && feature.options) {
                    const option = feature.options.find((fOption) =>
                      formData.features.some((sFeature) => sFeature.option === fOption.id)
                    )
                    return (
                      <div>
                        {feature.desc && <div>{parse(feature.desc)}</div>}
                        {sectionSteps.map((sectionStep, nameIndex) => {
                          return (
                            <Fragment key={nameIndex}>
                              {option[sectionStep]?.length > 0 &&
                                option[sectionStep].map((section: SectionDataType) => {
                                  if (
                                    section.attributes?.some((attribute) => attribute === Attributes.providesOptions)
                                  ) {
                                    // Check if selectionCount exists and is greater than 0
                                    const selectionCount = section?.selectionCount || 1

                                    // Repeat Dropdown component based on selectionCount
                                    const dropdowns = Array.from({ length: selectionCount }, (_, index) => {
                                      const optionIndex = index & fIndex & classIndex

                                      const { options, label, path, exist } = getSectionOptions({
                                        section,
                                        sectionStep,
                                        optionIndex,
                                      })

                                      return (
                                        <div className={option_dropdown} key={index}>
                                          <Dropdown
                                            name={path}
                                            label={`${label} Option`}
                                            options={options}
                                            onChange={updateFormData}
                                            value={exist}
                                          />
                                        </div>
                                      )
                                    })

                                    return dropdowns
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

export default ClassFeature
