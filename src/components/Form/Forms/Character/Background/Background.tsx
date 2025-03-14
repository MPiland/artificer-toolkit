import { Character } from '../../../../../../amplify/gql/types'
import { SectionName, UpdateState } from '../../../../../types/form'
import { use } from 'react'
import { FormContext } from '../../../FormContext'
import Collapse from '../../../../Collapse/Collapse'
import Grid from '../../../../Grid/Grid'
import { useListBackgroundsQuery } from '../../../../../features/backgrounds/backgroundsApi'
import CharacterCurrency from '../../../Subforms/Character/CharacterEquipment/CharacterCurrency'
import Dropdown from '../../../../Dropdown/Dropdown'
import { option_dropdown } from '../../../Character.css'
import parse from 'html-react-parser'
import CharacterEquipment from '../../../Subforms/Character/CharacterEquipment/CharacterEquipment'
import useGetFeatures, { FactoryFeature } from '../../../../../hooks/useGetFeatures'
import FeatureSection from '../../../Subforms/Character/Class/Features/FeatureSection'
import { Attributes } from '../../../../../types/enums'
import { FeatureContext } from '../../../Features/FeatureContext'
import FeatureOption from '../../../Subforms/Character/Class/Features/FeatureOption'

const Background = () => {
  const { formData, updateFormData, features } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
    features: FactoryFeature[]
  }

  const { sectionSteps } = use(FeatureContext)

  const { data: backgrounds } = useListBackgroundsQuery()
  const { getFullFeature } = useGetFeatures({ data: formData })

  const background = backgrounds.find((b) => b.id === formData.background)

  return (
    <>
      <Grid>
        <Grid.Item justify='center'>
          <Dropdown
            name='background'
            label='Background'
            options={backgrounds}
            className={option_dropdown}
            onChange={updateFormData}
            value={formData?.background}
          />
        </Grid.Item>
        {formData?.background && (
          <>
            {background?.desc && (
              <Grid.Item>
                <Collapse>
                  <Collapse.Header title='Description' />
                  <Collapse.Body>{background?.desc && parse(background?.desc)}</Collapse.Body>
                </Collapse>
              </Grid.Item>
            )}
            {features
              ?.filter((feature) => feature.backgroundId === background.id)
              ?.map((feature, featureIndex) => (
                <Grid.Item key={feature?.id}>
                  <Collapse>
                    <Collapse.Header title={feature?.label} />
                    <Collapse.Body>
                      <Grid>
                        <Grid.Item>{feature?.desc && parse(feature?.desc)}</Grid.Item>
                        {!(getFullFeature(feature)?.options?.length > 0) ? (
                          sectionSteps.map(
                            (sectionStep: SectionName) =>
                              feature[sectionStep]?.length > 0 &&
                              feature[sectionStep].map((section, sIndex) => {
                                if (
                                  section?.attributes?.some((attribute) => attribute === Attributes.providesOptions)
                                ) {
                                  return (
                                    <FeatureSection
                                      key={sIndex}
                                      section={section}
                                      sectionStep={sectionStep}
                                      featureIndex={featureIndex}
                                      backgroundId={background.id}
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
              ))}
            <Grid.Item>
              <Collapse>
                <Collapse.Header title='Starting Equipment' />
                <Collapse.Body>
                  <Grid>
                    <CharacterEquipment dataSource={background} />
                  </Grid>
                </Collapse.Body>
              </Collapse>
            </Grid.Item>
            <CharacterCurrency />
          </>
        )}
      </Grid>
    </>
  )
}

export default Background
