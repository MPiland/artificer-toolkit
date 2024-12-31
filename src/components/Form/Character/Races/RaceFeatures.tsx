import parse from 'html-react-parser'
import { Fragment, use, useCallback, useEffect, useMemo } from 'react'
import Dropdown from '../../../Dropdown/Dropdown'
import { isEqual } from 'lodash'
import { sprinkles } from '../../../../css/sprinkles.css'
import { feature_card, feature_card_body, feature_card_header } from '../Character.css'
import { option_dropdown } from '../Character.css'
import ScrollArea from '../../../ScrollArea/ScrollArea'
import Collapse from '../../../Collapse/Collapse'
import {
  AncestryFeature,
  AncestryOption,
  Character,
  CharacterModifier,
  CharacterProficiency,
  Feature,
  Race,
  CharacterSense,
  CharacterFeat,
  CharacterExpertise,
  CharacterFeature,
} from '../../../../../amplify/API'
import { SectionName, UpdateState } from '../../../../types/form'
import FeatureContext from '../../Features/FeatureContext'
import useGetSections from '../../../../hooks/useGetSectionState'
import { Attributes } from '../../../../types/enums'

const RaceFeatures = ({
  fullRace,
  fullAncestry,
  updateFormData,
  formData,
  raceLineages,
}: {
  fullRace: Race
  fullAncestry: AncestryOption
  updateFormData: (arg: UpdateState<Character>) => void
  formData: Character
  raceLineages: Race[]
}) => {
  const { sectionSteps } = use(FeatureContext)
  const { getSectionOptions } = useGetSections({ state: formData })

  const setFormRaces = useCallback(() => {
    const racesArray: { race: Race | AncestryOption; type: 'race' | 'ancestry' }[] = []
    if (fullRace) {
      racesArray.push({ race: fullRace, type: 'race' })
    }
    if (raceLineages) {
      raceLineages?.forEach((lineage) => {
        racesArray.push({ race: lineage, type: 'race' })
      })
    }
    if (fullAncestry) {
      racesArray.push({ race: fullAncestry, type: 'ancestry' })
    }

    return racesArray
  }, [fullAncestry, fullRace, raceLineages])

  const formRaces = useMemo(() => setFormRaces(), [setFormRaces])

  const createFeatures = useCallback(() => {
    const featureArrayUpdated: Array<
      | (Feature & { raceId?: string; ancestryId?: string })
      | (AncestryFeature & { raceId?: string; ancestryId?: string })
    > = []

    formRaces.forEach((raceObject) => {
      /* Whether the feature is a lineage or base race, match it to the base race selected.
      If it's an ancestry, match it to itself based on the state */
      const featureRace = raceObject.type === 'ancestry' ? fullAncestry : fullRace

      // Default full features based off the raceObject
      let fullFeatures = raceObject.race?.features

      if (raceObject.type === 'ancestry') {
        // Use formData race to get the ancestry options and then find the option based on the selected ancestry race
        fullFeatures = fullAncestry.features
      }

      /* Inject feature into array based off type
      If lineage or base, use base race Id
      If ancestry, use the ancestry Id
      This will allow for removing erroneous features using unique identifiers */
      fullFeatures?.forEach((feature: Feature | AncestryFeature) => {
        if (!featureArrayUpdated.some((aFeature) => aFeature.id === feature.id)) {
          featureArrayUpdated.push({ ...feature, [`${raceObject.type}Id`]: featureRace.id })
        }
      })
    })

    featureArrayUpdated.sort((a, b) => a.value.localeCompare(b.value))

    return featureArrayUpdated
  }, [fullAncestry, fullRace, formRaces])

  const features = useMemo(() => createFeatures(), [createFeatures])

  // Memoize the feature sections

  // Update state sections
  useEffect(() => {
    let ancestryMapped: boolean = false
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

    const createObject = (type?: 'ancestry', dataSectionObject?: Character) => {
      if (dataSectionObject) {
        characterData = dataSectionObject
      }

      const sectionRace = type === 'ancestry' ? fullAncestry : fullRace

      if (features && features?.length > 0) {
        features?.forEach((feature) => {
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
                            (section.__typename === 'CharacterProficiency' && section.proficiencyId === fSection.id)) &&
                          section.raceId === sectionRace.id &&
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
            }
          })
        })
      }
    }

    createObject()

    if (formData.ancestry && !ancestryMapped) {
      ancestryMapped = true
      createObject('ancestry', characterData)
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
  }, [features, formData, fullAncestry, fullRace, sectionSteps, updateFormData])

  // Update race features
  useEffect(() => {
    const formClone: Character = JSON.parse(JSON.stringify(formData))

    features?.forEach((feature) => {
      const characterFeatures: CharacterFeature[] = formClone.features || []
      if (feature.ancestryId) {
        if (!characterFeatures.some((cFeature) => cFeature.ancestryId === feature.ancestryId)) {
          formClone.features.push({ id: feature.id, ancestryId: feature.ancestryId, __typename: 'CharacterFeature' })
        }
      }
      if (feature.raceId) {
        if (!characterFeatures.some((cFeature) => cFeature.raceId === feature.raceId)) {
          formClone.features.push({ id: feature.id, raceId: feature.raceId, __typename: 'CharacterFeature' })
        }
      }
    })

    if (!isEqual(formClone.features, formData.features)) {
      updateFormData({
        type: 'update',
        path: 'features',
        value: formClone.features,
      })
    }
  }, [features, formData, updateFormData])

  const handleAncestryChange = (e: UpdateState<Character>) => {
    if (e.type === 'update') {
      const ancestryId = e.value
      const ancestry = fullRace.ancestry.options.find((option) => option.id === ancestryId)
      if (ancestry) {
        updateFormData({
          type: 'update',
          path: 'ancestry',
          value: { id: ancestryId, raceId: fullRace.id },
        })
      }
    }
  }

  return (
    <>
      {raceLineages?.length > 0 &&
        raceLineages?.map(
          (lineage, index) =>
            lineage?.ancestry?.options?.length > 0 && (
              <div className={feature_card} key={index}>
                <div className={feature_card_header}>
                  <h2>{lineage?.ancestry.value}</h2>
                </div>
                <div className={feature_card_body}>
                  {lineage?.ancestry.desc && parse(lineage?.ancestry.desc)}
                  <div className={option_dropdown}>
                    <Dropdown
                      name={`ancestry.id`}
                      label='Ancestry Option'
                      options={lineage?.ancestry.options.map((option) => ({
                        label: option.label,
                        value: option.value,
                        desc: option.desc,
                        id: option.id,
                        raceId: lineage.id,
                      }))}
                      onChange={updateFormData}
                      value={formData.ancestry.id}
                    />
                    {formData?.ancestry && <strong>{fullAncestry.desc && parse(fullAncestry.desc)}</strong>}
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
              <Dropdown<Character>
                name='ancestry.id'
                label='Ancestry Option'
                options={fullRace.ancestry.options}
                value={formData.ancestry.id}
                onChange={(e) => handleAncestryChange(e)}
              />
              {fullAncestry && <strong>{fullAncestry?.desc && parse(fullAncestry?.desc)}</strong>}
            </div>
          </ScrollArea>
        </div>
      )}
      {features &&
        features?.length > 0 &&
        features?.map((feature, featureIndex) => {
          return (
            <Collapse key={featureIndex}>
              <Collapse.Header title={feature.value} className={feature_card_header} />
              <Collapse.Body>
                <ScrollArea scrollDirection='horizontal' className={feature_card_body}>
                  {feature.desc && parse(feature.desc)}
                  {sectionSteps.map((sectionStep: Exclude<SectionName, 'ancestries'>, nameIndex: number) => (
                    <Fragment key={nameIndex}>
                      {feature[sectionStep]?.length > 0 &&
                        feature[sectionStep].map((section) => {
                          if (section.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
                            // Check if selectionCount exists and is greater than 0
                            const selectionCount = section.selectionCount || 1

                            // Repeat Dropdown component based on selectionCount
                            const dropdowns = Array.from({ length: selectionCount }, (_, index) => {
                              const optionIndex = index & featureIndex

                              const { options, label, path, exist } = getSectionOptions({
                                section,
                                sectionStep,
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
                                  label={`${label} Option`}
                                  options={options}
                                  onChange={updateFormData}
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
        })}
    </>
  )
}

export default RaceFeatures
