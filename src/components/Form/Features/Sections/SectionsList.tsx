import { use } from 'react'
import { FeatureDataType, SectionDataType, SectionName, UpdateState } from '../../../../types/form'
import Accordion from '../../../Accordion/Accordion'
import Group from '../../../Group/Group'
import { sprinkles } from '../../../../css/sprinkles.css'
import { startCase } from 'lodash'
import { feature_description } from '../../Form.css'
import parse from 'html-react-parser'
import FeatureContext from '../FeatureContext'
import { sectionSteps } from '../../../../types/form'
import { Feature, FeatureOption, Subfeature } from '../../../../../amplify/API'

const SectionsList = ({
  featureData,
  updateFeatureData,
}: {
  featureData: FeatureDataType
  updateFeatureData: (state: UpdateState<FeatureDataType>) => void
}) => {
  const { featureStep, setFeatureStep, setSectionStep, updateSectionData, updateOptionData, updateSubfeatureData } =
    use(FeatureContext)

  const handleRemove = (sectionStep: SectionName, sectionIndex: number) => {
    updateFeatureData({
      type: 'remove',
      path: `${sectionStep}.${sectionIndex}`,
    })
  }

  const handleEdit = (
    sectionStep: SectionName,
    sectionIndex: number,
    sectionItem: SectionDataType | FeatureOption | Subfeature
  ) => {
    updateSectionData({ type: 'index', value: sectionIndex })
    if (featureStep === 'subfeature') {
      updateSubfeatureData({
        type: 'reset',
        value: sectionItem,
      })
      updateSubfeatureData({ type: 'index', value: sectionIndex })
      updateSubfeatureData({ type: 'initialReset', value: sectionItem })
      return setFeatureStep('subfeature')
    } else if (featureStep === 'option') {
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

  return (
    <>
      {sectionSteps.map((sectionStep, index) => {
        let sections: SectionDataType[] | FeatureOption[] | Subfeature[]
        if (featureData.__typename === 'AncestryFeature') {
          sections =
            featureData[sectionStep as Exclude<SectionName, 'ancestries'>] ||
            featureData?.options ||
            featureData?.subfeatures
        } else {
          sections =
            featureData[sectionStep] ||
            (featureData as Feature)?.options ||
            (featureData as Feature | FeatureOption)?.subfeatures
        }
        return (
          sections?.length > 0 && (
            <Accordion<FeatureDataType>
              key={index}
              dataArray={sections}
              onChange={updateFeatureData}
              name={sectionStep}
              disableSort={featureStep !== 'option' && featureStep !== 'subfeature'}
            >
              {sections?.map((section, sIndex) => {
                return (
                  <Accordion.Wrapper key={sIndex} itemId={String(sIndex)}>
                    <Accordion.Header
                      key={sIndex}
                      handleRemove={() => handleRemove(sectionStep, sIndex)}
                      handleEdit={() => handleEdit(sectionStep, sIndex, section)}
                    >
                      {featureStep !== 'subfeature' && `${startCase(sectionStep)} ${sIndex + 1}`}
                      {(section.__typename === 'FeatureOption' || section.__typename === 'Subfeature') &&
                        section?.value != null &&
                        section?.value}
                    </Accordion.Header>
                    {(featureStep === 'option' || featureStep === 'subfeature') && (
                      <>
                        <Accordion.Content>
                          <div className={feature_description}>
                            {(section.__typename === 'FeatureOption' || section.__typename === 'Subfeature') &&
                              section?.desc &&
                              parse(section?.desc)}
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
                                  {(section.__typename === 'FeatureOption' || section.__typename === 'Subfeature') &&
                                  section[fSectionStep]?.length > 0 ? (
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
          )
        )
      })}
    </>
  )
}

export default SectionsList
