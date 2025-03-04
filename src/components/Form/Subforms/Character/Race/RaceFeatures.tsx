import parse from 'html-react-parser'
import { Fragment, use } from 'react'
import Dropdown from '../../../../Dropdown/Dropdown'
import { feature_card_header } from '../../../Character.css'
import { option_dropdown } from '../../../Character.css'
import Collapse from '../../../../Collapse/Collapse'
import { AncestryFeature, AncestryOption, Character, Feature, Race } from '../../../../../../amplify/gql/types'
import { SectionName, UpdateState } from '../../../../../types/form'
import { FeatureContext } from '../../../Features/FeatureContext'
import useGetSections from '../../../../../hooks/useGetSectionState'
import { Attributes } from '../../../../../types/enums'
import { FormContext } from '../../../FormContext'
import { sprinkles } from '../../../../../css/sprinkles.css'

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
  const { features } = use(FormContext)
  const { getSectionOptions } = useGetSections({ formData })

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

    if (e.type === 'remove') {
      updateFormData({
        type: 'remove',
        path: 'ancestry',
      })
    }
  }

  return (
    <>
      {raceLineages?.length > 0 &&
        raceLineages?.map(
          (lineage, index) =>
            lineage?.ancestry?.options?.length > 0 && (
              <Collapse key={index}>
                <Collapse.Header title={lineage?.ancestry.label} className={feature_card_header} />
                <Collapse.Body>
                  {lineage?.ancestry.desc && parse(lineage?.ancestry.desc)}
                  <div className={option_dropdown}>
                    <Dropdown
                      name={`ancestry.id`}
                      label='Ancestry Option'
                      className={sprinkles({ mb: 'space-2' })}
                      options={lineage?.ancestry.options}
                      onChange={updateFormData}
                      value={formData?.ancestry?.id}
                    />
                    {formData?.ancestry && <strong>{fullAncestry.desc && parse(fullAncestry.desc)}</strong>}
                  </div>
                </Collapse.Body>
              </Collapse>
            )
        )}
      {fullRace.ancestry?.options?.length > 0 && (
        <Collapse>
          <Collapse.Header title={fullRace.ancestry.label} className={feature_card_header} />
          <Collapse.Body>
            {fullRace.ancestry.desc && parse(fullRace.ancestry.desc)}
            <div className={option_dropdown}>
              <Dropdown<Character>
                name='ancestry.id'
                label='Ancestry Option'
                options={fullRace.ancestry.options}
                className={sprinkles({ mb: 'space-2' })}
                value={formData?.ancestry?.id}
                onChange={(e) => handleAncestryChange(e)}
              />
              {fullAncestry && <strong>{fullAncestry?.desc && parse(fullAncestry?.desc)}</strong>}
            </div>
          </Collapse.Body>
        </Collapse>
      )}
      {features &&
        features?.length > 0 &&
        features
          ?.filter((feature) => feature?.raceId === fullRace.id)
          .map((feature, featureIndex) => {
            const fullFeature: Feature | AncestryFeature = fullRace.features?.find(
              (aFeature) => aFeature.id === feature.id
            )
            return (
              <Collapse key={featureIndex}>
                <Collapse.Header title={fullFeature?.label} className={feature_card_header} />
                <Collapse.Body>
                  {fullFeature?.desc && parse(fullFeature?.desc)}
                  {sectionSteps.map(
                    (
                      sectionStep: Exclude<SectionName, 'ancestries' | 'options' | 'subfeatures'>,
                      nameIndex: number
                    ) => (
                      <Fragment key={nameIndex}>
                        {fullFeature?.[sectionStep]?.length > 0 &&
                          fullFeature?.[sectionStep].map((section) => {
                            if (section.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
                              // Check if selectionCount exists and is greater than 0
                              const selectionCount = section.selectionCount || 1

                              // Repeat Dropdown component based on selectionCount
                              const dropdowns = Array.from({ length: selectionCount }, (_, index) => {
                                const optionIndex = `${index}${featureIndex}`

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
                                    className={option_dropdown}
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
                    )
                  )}
                </Collapse.Body>
              </Collapse>
            )
          })}
      {fullAncestry &&
        features &&
        features?.length > 0 &&
        features
          ?.filter((feature) => feature?.ancestryId != null)
          .map((feature, fIndex) => {
            const fullFeature: Feature | AncestryFeature = fullAncestry?.features?.find(
              (aFeature) => aFeature.id === feature.id
            )
            return (
              <Collapse key={fIndex}>
                <Collapse.Header title={fullFeature?.label} className={feature_card_header} />
                <Collapse.Body>
                  {fullFeature?.desc && parse(fullFeature?.desc)}
                  {sectionSteps.map(
                    (
                      sectionStep: Exclude<SectionName, 'ancestries' | 'options' | 'subfeatures'>,
                      nameIndex: number
                    ) => (
                      <Fragment key={nameIndex}>
                        {fullFeature?.[sectionStep]?.length > 0 &&
                          fullFeature?.[sectionStep].map((section) => {
                            if (section.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
                              // Check if selectionCount exists and is greater than 0
                              const selectionCount = section.selectionCount || 1

                              // Repeat Dropdown component based on selectionCount
                              const dropdowns = Array.from({ length: selectionCount }, (_, index) => {
                                const optionIndex = `${index}${fIndex}`

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
                                    className={option_dropdown}
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
                    )
                  )}
                </Collapse.Body>
              </Collapse>
            )
          })}
    </>
  )
}

export default RaceFeatures
