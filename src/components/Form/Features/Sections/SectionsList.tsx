import { use } from 'react'
import type { FeatureDataType, SectionDataType, SectionName, FeatureOption } from '@/types'
import Accordion from '@/components/Accordion'
import Group from '@/components/Group'
import { sprinkles } from '@/css/sprinkles.css'
import { startCase } from 'lodash'
import { feature_description } from '../../Form.css'
import { sectionSteps } from '../../Form.utils'
import parse from 'html-react-parser'
import { FeatureContext } from '../FeatureContext'
import Grid from '@/components/Grid'
import type { OptionStore, FeatureStore } from '@/store'

const SectionsList = ({ featureStore }: { featureStore: FeatureStore | OptionStore }) => {
  const {
    sectionStore,
    optionStore,
    featureStore: { setStep: setFeatureStep, step: featureStep },
  } = use(FeatureContext)

  const handleRemove = (sectionStep: SectionName | 'options', sectionIndex: number) => {
    if (sectionStep !== 'options') {
      return (featureStore as OptionStore).removeField({
        path: `${sectionStep}.${sectionIndex}`,
      })
    }
    return (featureStore as FeatureStore).removeField({
      path: `${sectionStep}.${sectionIndex}`,
    })
  }

  const handleEdit = (
    sectionStep: SectionName | 'options',
    sectionIndex: number,
    sectionItem: SectionDataType | FeatureOption
  ) => {
    sectionStore.setIndex({ value: sectionIndex })
    if (sectionStep === 'options' && sectionItem.__typename === 'FeatureOption') {
      optionStore.resetData({
        value: sectionItem,
      })
      optionStore.setIndex({ value: sectionIndex })
      optionStore.resetInit({ value: sectionItem })
      return setFeatureStep('option')
    } else if (sectionStep !== 'options' && sectionItem.__typename !== 'FeatureOption') {
      sectionStore.setStep(sectionStep)
      sectionStore.resetData({
        value: sectionItem,
      })
      sectionStore.resetInit({ value: sectionItem })
    }
  }

  const sectionsAndOptions = [...sectionSteps, 'options'] as const

  return (
    <>
      {sectionsAndOptions.map((sectionStep, index) => {
        let sections: SectionDataType[] | FeatureOption[] = []
        if (featureStore.data.__typename === 'AncestryFeature') {
          if (featureStore.data?.[sectionStep]?.length) {
            sections = featureStore.data?.[sectionStep]
          }
        } else if (featureStore.data.__typename === 'FeatureOption' && sectionStep !== 'options') {
          if (featureStore.data?.[sectionStep]?.length) {
            sections = featureStore.data[sectionStep]
          }
        } else if (featureStore.data.__typename === 'Feature') {
          if (featureStore.data?.[sectionStep]?.length) {
            sections = featureStore.data[sectionStep]
          }
        }
        return (
          sections?.length > 0 && (
            <Grid.Item key={index}>
              <Accordion<FeatureDataType>
                key={index}
                dataArray={sections}
                onChange={featureStore}
                name={sectionStep}
                disableSort={featureStep !== 'option'}
              >
                {sections?.map((section, sIndex) => {
                  return (
                    <Accordion.Wrapper key={sIndex} itemId={String(sIndex)}>
                      <Accordion.Header
                        key={sIndex}
                        handleRemove={() => handleRemove(sectionStep, sIndex)}
                        handleEdit={() => handleEdit(sectionStep, sIndex, section)}
                        expandable={section.__typename === 'FeatureOption'}
                      >
                        {section.__typename === 'FeatureOption' && section?.value != null ?
                          section?.label
                        : `${startCase(sectionStep)} ${sIndex + 1}`}
                      </Accordion.Header>
                      {section.__typename === 'FeatureOption' && section.__typename === 'FeatureOption' && (
                        <>
                          <Accordion.Content>
                            <div className={feature_description}>
                              {section.__typename === 'FeatureOption' && section?.desc && parse(section?.desc)}
                            </div>
                          </Accordion.Content>

                          <Accordion.Footer>
                            <Group justifyContentVariant='start'>
                              {sectionSteps.map((fSectionStep, fSIndex) => {
                                return (
                                  <span
                                    key={fSIndex}
                                    className={sprinkles({
                                      me: 'space-3',
                                    })}
                                  >
                                    {section?.[fSectionStep]?.length ?
                                      <strong key={fSIndex}>
                                        {startCase(fSectionStep.charAt(0))}:{section[fSectionStep]?.length}
                                      </strong>
                                    : `${startCase(fSectionStep.charAt(0))}: 0`}
                                  </span>
                                )
                              })}
                            </Group>
                          </Accordion.Footer>
                        </>
                      )}
                    </Accordion.Wrapper>
                  )
                })}
              </Accordion>
            </Grid.Item>
          )
        )
      })}
    </>
  )
}

export default SectionsList
