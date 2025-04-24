import { use } from 'react'
import { FormContext } from '../../../FormContext'
import Grid from '@/components/Grid'
import Collapse from '@/components/Collapse'
import { Attributes, Categories } from '@/enums'
import { feature_card_header, option_dropdown } from '../../../Character.css'
import parse from 'html-react-parser'
import type { SectionName, OnChange, Character, CharacterClass } from '@/types'
import Dropdown from '@/components/Dropdown'
import { FeatureContext } from '../../../Features'
import FeatureSection from './FeatureSection'
import FeatureOption from './FeatureOption'
import { useGetFeatures, type FactoryFeature, useClassData } from '@/hooks'

interface CharacterFeatureProps {
  uClass?: CharacterClass
  feature: FactoryFeature
  classIndex?: number
  raceId?: string
  backgroundId?: string
}

const CharacterFeature = ({ uClass, feature, classIndex, raceId, backgroundId }: CharacterFeatureProps) => {
  const {
    formStore: { data, updateField, removeField },
  } = use(FormContext) as {
    formStore: {
      data: Character
      updateField: OnChange<Character>['updateField']
      removeField: OnChange<Character>['removeField']
    }
  }

  const {
    classes: { findClass },
    subclasses: { findByParent },
  } = useClassData()
  const { getFullFeature } = useGetFeatures({ data: data })

  const { sectionSteps } = use(FeatureContext)

  const existFeatureIndex = data?.features?.findIndex((f) => f?.id === feature?.id && f?.level === feature?.level)

  const featureIndex = existFeatureIndex && existFeatureIndex > -1 ? existFeatureIndex : data?.features?.length || 0

  const headerTitle = `${feature.level && `(${feature.level}) `}${feature?.label || `Feature (${featureIndex})`}`

  const subclasses = findByParent(uClass?.id)
  const subclass = findClass(uClass?.subclass?.id)

  return (
    <Grid.Item>
      <Collapse>
        <Collapse.Header title={headerTitle} className={feature_card_header} />
        <Collapse.Body>
          <Grid>
            {feature.category === Categories.SUBCLASS && feature?.detail && parse(feature?.detail)}
            {feature.desc && parse(feature.desc)}
            {feature.category === Categories.SUBCLASS && uClass && classIndex && subclasses?.length && (
              <>
                <Grid.Item justify='center'>
                  <Dropdown
                    name={`classes.${classIndex}.subclass.id`}
                    className={option_dropdown}
                    label={'Subclass Option'}
                    options={subclasses}
                    onChange={{ updateField, removeField }}
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
                      onChange={{ updateField, removeField }}
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
                    if (section?.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS)) {
                      return (
                        <FeatureSection
                          key={sIndex}
                          section={section}
                          sectionStep={sectionStep}
                          featureIndex={featureIndex}
                          classIndex={classIndex}
                          classId={uClass?.id}
                          raceId={raceId}
                          backgroundId={backgroundId}
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
                  data?.features?.[featureIndex]?.options?.find((o) => o.id === fOption.id)
                )

                if (option) {
                  return (
                    <>
                      <Grid.Item justify='center'>{option?.desc && <div>{parse(option.desc)}</div>}</Grid.Item>
                      {sectionSteps.map(
                        (sectionStep) =>
                          option?.[sectionStep]?.length &&
                          option?.[sectionStep]?.map((section) => {
                            if (section.attributes?.some((attribute) => attribute === Attributes.PROVIDES_OPTIONS)) {
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
