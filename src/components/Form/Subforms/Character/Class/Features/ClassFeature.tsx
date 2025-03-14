import { use } from 'react'
import { Character, Class } from '../../../../../../../amplify/gql/types'
import { FormContext } from '../../../../FormContext'
import Grid from '../../../../../Grid/Grid'
import Collapse from '../../../../../Collapse/Collapse'
import { Attributes, Categories } from '../../../../../../types/enums'
import { feature_card_header, option_dropdown } from '../../../../Character.css'
import parse from 'html-react-parser'
import { SectionName, UpdateState } from '../../../../../../types/form'
import Dropdown from '../../../../../Dropdown/Dropdown'
import { FeatureContext } from '../../../../Features/FeatureContext'
import FeatureSection from './FeatureSection'
import FeatureOption from './FeatureOption'
import useGetFeatures, { FactoryFeature } from '../../../../../../hooks/useGetFeatures'

interface ClassFeatureProps {
  fullClass: Class
  feature: FactoryFeature
  subclass: Class
  subclasses: Class[]
}

const ClassFeature = ({ fullClass, feature, subclass, subclasses }: ClassFeatureProps) => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }

  const { getFullFeature } = useGetFeatures({ data: formData })

  const { sectionSteps } = use(FeatureContext)

  const classIndex = formData.classes.findIndex((c) => c.id === fullClass.id)

  const uClass = formData.classes[classIndex]

  const existFeatureIndex = formData?.features?.findIndex((f) => f?.id === feature?.id && f?.level === feature?.level)

  const featureIndex = existFeatureIndex > -1 ? existFeatureIndex : formData?.features?.length || 0

  return (
    <Grid.Item>
      <Collapse>
        <Collapse.Header title={`(${feature.level}) ${feature.label}`} className={feature_card_header} />
        <Collapse.Body>
          <Grid>
            {feature.category === Categories.subclass && feature?.detail && parse(feature?.detail)}
            {feature.desc && parse(feature.desc)}
            {feature.category === Categories.subclass && (
              <>
                <Grid.Item justify='center'>
                  <Dropdown
                    name={`classes.${classIndex}.subclass.id`}
                    className={option_dropdown}
                    label={'Subclass Option'}
                    options={subclasses}
                    onChange={updateFormData}
                    value={uClass?.subclass?.id}
                  />
                </Grid.Item>
                {subclass?.subtypes?.length > 0 && (
                  <Grid.Item justify='center'>
                    <Dropdown
                      name={`classes.${classIndex}.subclass.subtype`}
                      className={option_dropdown}
                      label={'Subtype Option'}
                      options={subclass?.subtypes}
                      onChange={updateFormData}
                      value={uClass?.subclass?.subtype}
                    />
                  </Grid.Item>
                )}
              </>
            )}
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
                          classIndex={classIndex}
                          classId={uClass.id}
                        />
                      )
                    }
                  })
              )
            ) : (
              <FeatureOption feature={feature} featureIndex={featureIndex} classIndex={classIndex} />
            )}
            {(() => {
              if (feature && feature.options) {
                const option = getFullFeature(feature).options.find((fOption) =>
                  formData.features[featureIndex]?.options?.find((o) => o.id === fOption.id)
                )

                return (
                  <>
                    <Grid.Item justify='center'>{option?.desc && <div>{parse(option.desc)}</div>}</Grid.Item>
                    {sectionSteps.map(
                      (sectionStep) =>
                        option?.[sectionStep]?.length > 0 &&
                        option?.[sectionStep]?.map((section) => {
                          if (section.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
                            return (
                              <FeatureSection
                                key={section.id}
                                section={section}
                                sectionStep={sectionStep}
                                featureIndex={featureIndex}
                                classIndex={classIndex}
                                classId={uClass.id}
                                optionId={option.id}
                              />
                            )
                          }
                        })
                    )}
                  </>
                )
              }
            })()}
          </Grid>
        </Collapse.Body>
      </Collapse>
    </Grid.Item>
  )
}
export default ClassFeature
