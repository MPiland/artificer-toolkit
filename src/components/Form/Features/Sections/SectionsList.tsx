import { use } from 'react'
import { FeatureDataType, SectionDataType, SectionName, UpdateState } from '../../../../types/form'
import Accordion from '../../../Accordion/Accordion'
import Group from '../../../Group/Group'
import { sprinkles } from '../../../../css/sprinkles.css'
import { startCase } from 'lodash'
import { feature_description } from '../../Form.css'
import parse from 'html-react-parser'
import { FeatureContext } from '../FeatureContext'
import { sectionSteps } from '../../../../types/form'
import { FeatureOption } from '../../../../../amplify/gql/types'
import Grid from '../../../Grid/Grid'

const SectionsList = ({
  featureData,
  updateFeatureData,
}: {
  featureData: FeatureDataType
  updateFeatureData: (state: UpdateState<FeatureDataType>) => void
}) => {
  const { featureStep, setFeatureStep, setSectionStep, updateSectionData, updateOptionData } = use(FeatureContext)

  const handleRemove = (sectionStep: SectionName | 'options', sectionIndex: number) => {
    updateFeatureData({
      type: 'remove',
      path: `${sectionStep}.${sectionIndex}`,
    })
  }

  const handleEdit = (
    sectionStep: SectionName | 'options',
    sectionIndex: number,
    sectionItem: SectionDataType | FeatureOption
  ) => {
    updateSectionData({ type: 'index', value: sectionIndex })
    if (sectionStep === 'options') {
      updateOptionData({
        type: 'reset',
        value: sectionItem,
      })
      updateOptionData({ type: 'index', value: sectionIndex })
      updateOptionData({ type: 'initialReset', value: sectionItem })
      return setFeatureStep('option')
    }
    setSectionStep(sectionStep)
    updateSectionData({
      type: 'reset',
      value: sectionItem,
    })
    updateSectionData({ type: 'initialReset', value: sectionItem })
  }

  const sectionsAndOptions = [...sectionSteps, 'options'] as const

  return (
    <>
      {sectionsAndOptions.map((sectionStep, index) => {
        let sections: SectionDataType[] | FeatureOption[]
        if (featureData.__typename === 'AncestryFeature') {
          sections = featureData[sectionStep as SectionName] || featureData?.options
        } else if (featureData.__typename === 'FeatureOption') {
          sections = featureData[sectionStep as Exclude<SectionName, 'options'>]
        } else {
          sections = featureData[sectionStep as SectionName]
        }
        return (
          sections?.length > 0 && (
            <Grid.Item key={index}>
              <Accordion<FeatureDataType>
                key={index}
                dataArray={sections}
                onChange={updateFeatureData}
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
                        {section.__typename === 'FeatureOption' && section?.value != null
                          ? section?.label
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
                                    {section[fSectionStep]?.length > 0 ? (
                                      <strong key={fSIndex}>
                                        {startCase(fSectionStep.charAt(0))}:{section[fSectionStep]?.length}
                                      </strong>
                                    ) : (
                                      `${startCase(fSectionStep.charAt(0))}: 0`
                                    )}
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
