import parse from 'html-react-parser'
import { use } from 'react'
import Dropdown from '../../../../Dropdown/Dropdown'
import { feature_card_header } from '../../../Character.css'
import { option_dropdown } from '../../../Character.css'
import Collapse from '../../../../Collapse/Collapse'
import { AncestryOption, Character, Race } from '../../../../../../amplify/gql/types'
import { SectionName, UpdateState } from '../../../../../types/form'
import { FeatureContext } from '../../../Features/FeatureContext'
import { Attributes } from '../../../../../types/enums'
import { FormContext } from '../../../FormContext'
import Grid from '../../../../Grid/Grid'
import useGetFeatures from '../../../../../hooks/useGetFeatures'
import FeatureSection from '../Class/Features/FeatureSection'
import FeatureOption from '../Class/Features/FeatureOption'

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
  const { getFullFeature } = useGetFeatures({ data: formData })

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
              <Grid.Item key={index}>
                <Collapse>
                  <Collapse.Header title={lineage?.ancestry.label} className={feature_card_header} />
                  <Collapse.Body>
                    <Grid>
                      <Grid.Item>{lineage?.ancestry.desc && parse(lineage?.ancestry.desc)}</Grid.Item>
                      <Grid.Item justify='center'>
                        <Dropdown
                          name={`ancestry.id`}
                          label='Ancestry Option'
                          className={option_dropdown}
                          options={lineage?.ancestry.options}
                          onChange={updateFormData}
                          value={formData?.ancestry?.id}
                        />
                      </Grid.Item>
                      {formData?.ancestry && (
                        <Grid.Item justify='center'>
                          <strong>{fullAncestry.desc && parse(fullAncestry.desc)}</strong>
                        </Grid.Item>
                      )}
                    </Grid>
                  </Collapse.Body>
                </Collapse>
              </Grid.Item>
            )
        )}
      {fullRace.ancestry?.options?.length > 0 && (
        <Grid.Item>
          <Collapse>
            <Collapse.Header title={fullRace.ancestry.label} className={feature_card_header} />
            <Collapse.Body>
              <Grid>
                <Grid.Item>{fullRace.ancestry.desc && parse(fullRace.ancestry.desc)}</Grid.Item>
                <Grid.Item justify='center'>
                  <Dropdown<Character>
                    name='ancestry.id'
                    label='Ancestry Option'
                    options={fullRace.ancestry.options}
                    className={option_dropdown}
                    value={formData?.ancestry?.id}
                    onChange={(e) => handleAncestryChange(e)}
                  />
                </Grid.Item>
                {fullAncestry && (
                  <Grid.Item justify='center'>
                    <strong>{fullAncestry?.desc && parse(fullAncestry?.desc)}</strong>
                  </Grid.Item>
                )}
              </Grid>
            </Collapse.Body>
          </Collapse>
        </Grid.Item>
      )}
      {features
        ?.filter((feature) => feature?.raceId === fullRace.id)
        .map((feature, featureIndex) => {
          return (
            <Grid.Item key={featureIndex}>
              <Collapse>
                <Collapse.Header title={feature?.label} className={feature_card_header} />
                <Collapse.Body>
                  <Grid>
                    {feature?.desc && parse(feature?.desc)}
                    {!(getFullFeature(feature)?.options?.length > 0) ? (
                      sectionSteps.map(
                        (sectionStep: SectionName) =>
                          feature[sectionStep]?.length > 0 &&
                          feature[sectionStep].map((section, sIndex) => {
                            if (section?.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
                              return (
                                <FeatureSection
                                  key={sIndex}
                                  section={section}
                                  sectionStep={sectionStep}
                                  featureIndex={featureIndex}
                                  raceId={formData?.race}
                                />
                              )
                            }
                          })
                      )
                    ) : (
                      <FeatureOption feature={feature} featureIndex={featureIndex} />
                    )}
                  </Grid>
                </Collapse.Body>
              </Collapse>
            </Grid.Item>
          )
        })}
      {fullAncestry &&
        features
          ?.filter((feature) => feature?.ancestryId != null)
          .map((feature, featureIndex) => {
            return (
              <Grid.Item key={featureIndex}>
                <Collapse>
                  <Collapse.Header title={feature?.label} className={feature_card_header} />
                  <Collapse.Body>
                    <Grid>
                      {feature?.desc && parse(feature?.desc)}
                      {!(getFullFeature(feature)?.options?.length > 0) ? (
                        sectionSteps.map(
                          (sectionStep: SectionName) =>
                            feature[sectionStep]?.length > 0 &&
                            feature[sectionStep].map((section, sIndex) => {
                              if (section?.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
                                return (
                                  <FeatureSection
                                    key={sIndex}
                                    section={section}
                                    sectionStep={sectionStep}
                                    featureIndex={featureIndex}
                                    raceId={formData?.race}
                                  />
                                )
                              }
                            })
                        )
                      ) : (
                        <FeatureOption feature={feature} featureIndex={featureIndex} />
                      )}
                    </Grid>
                  </Collapse.Body>
                </Collapse>
              </Grid.Item>
            )
          })}
    </>
  )
}

export default RaceFeatures
