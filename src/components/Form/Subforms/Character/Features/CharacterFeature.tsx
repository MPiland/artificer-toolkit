import { use } from 'react'
import { Character, CharacterClass, Class } from '../../../../../../amplify/gql/types'
import { FormContext } from '../../../FormContext'
import Grid from '../../../../Grid/Grid'
import Collapse from '../../../../Collapse/Collapse'
import { Attributes, Categories } from '../../../../../types/enums'
import { feature_card_header, option_dropdown } from '../../../Character.css'
import parse from 'html-react-parser'
import { SectionName, UpdateState } from '../../../../../types/form'
import Dropdown from '../../../../Dropdown/Dropdown'
import { FeatureContext } from '../../../Features/FeatureContext'
import FeatureSection from './FeatureSection'
import FeatureOption from './FeatureOption'
import useGetFeatures, { FactoryFeature } from '../../../../../hooks/useGetFeatures'

interface CharacterFeatureProps {
  uClass?: CharacterClass
  feature: FactoryFeature
  subclasses?: Class[]
  subclass?: Class
  classIndex?: number
  raceId?: string
}

const CharacterFeature = ({ uClass, feature, subclasses, subclass, classIndex, raceId }: CharacterFeatureProps) => {
  const { formData, updateFormData } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }

  const { getFullFeature } = useGetFeatures({ data: formData })

  const { sectionSteps } = use(FeatureContext)

  const existFeatureIndex = formData?.features?.findIndex((f) => f?.id === feature?.id && f?.level === feature?.level)

  const featureIndex = existFeatureIndex && existFeatureIndex > -1 ? existFeatureIndex : formData?.features?.length || 0

  const headerTitle = `${feature.level && `(${feature.level}) `}${feature?.label || `Feature (${featureIndex})`}`

  return (
    <Grid.Item>
      <Collapse>
        <Collapse.Header title={headerTitle} className={feature_card_header} />
        <Collapse.Body>
          <Grid>
            {feature.category === Categories.subclass && feature?.detail && parse(feature?.detail)}
            {feature.desc && parse(feature.desc)}
            {feature.category === Categories.subclass && uClass && classIndex && subclasses?.length && (
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
                {subclass?.subtypes?.length && (
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
            {!getFullFeature(feature)?.options?.length ?
              sectionSteps.map(
                (sectionStep: SectionName) =>
                  feature[sectionStep]?.length &&
                  feature[sectionStep].map((section, sIndex) => {
                    if (section?.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
                      return (
                        <FeatureSection
                          key={sIndex}
                          section={section}
                          sectionStep={sectionStep}
                          featureIndex={featureIndex}
                          classIndex={classIndex}
                          classId={uClass?.id}
                          raceId={raceId}
                          feature={{ ...feature, __typename: 'CharacterFeature' }}
                        />
                      )
                    }
                  })
              )
            : <FeatureOption feature={feature} featureIndex={featureIndex} classIndex={classIndex} />}
            {(() => {
              if (feature && feature.options) {
                const option = getFullFeature(feature)?.options?.find((fOption) =>
                  formData?.features?.[featureIndex]?.options?.find((o) => o.id === fOption.id)
                )

                if (option) {
                  return (
                    <>
                      <Grid.Item justify='center'>{option?.desc && <div>{parse(option.desc)}</div>}</Grid.Item>
                      {sectionSteps.map(
                        (sectionStep) =>
                          option?.[sectionStep]?.length &&
                          option?.[sectionStep]?.map((section) => {
                            if (section.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
                              return (
                                <FeatureSection
                                  key={section.id}
                                  section={section}
                                  sectionStep={sectionStep}
                                  featureIndex={featureIndex}
                                  classIndex={classIndex}
                                  classId={uClass?.id}
                                  optionId={option.id}
                                  feature={{ ...option, __typename: 'CharacterFeature' }}
                                />
                              )
                            }
                          })
                      )}
                    </>
                  )
                }
              }
            })()}
          </Grid>
        </Collapse.Body>
      </Collapse>
    </Grid.Item>
  )
}
export default CharacterFeature
