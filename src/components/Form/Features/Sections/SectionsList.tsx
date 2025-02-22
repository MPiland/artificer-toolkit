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
import { FeatureOption, FeatureSubfeature } from '../../../../../amplify/gql/types'

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
    sectionItem: SectionDataType | FeatureOption | FeatureSubfeature
  ) => {
    updateSectionData({ type: 'index', value: sectionIndex })
    if (sectionStep === 'subfeatures') {
      updateSubfeatureData({
        type: 'reset',
        value: sectionItem,
      })
      updateSubfeatureData({ type: 'index', value: sectionIndex })
      updateSubfeatureData({ type: 'initialReset', value: sectionItem })
      return setFeatureStep('subfeature')
    } else if (sectionStep === 'options') {
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
        let sections: SectionDataType[] | FeatureOption[] | FeatureSubfeature[]
        if (featureData.__typename === 'AncestryFeature') {
          sections =
            featureData[sectionStep as Exclude<SectionName, 'ancestries'>] ||
            featureData?.options ||
            featureData?.subfeatures
        } else if (featureData.__typename === 'FeatureOption') {
          sections = featureData[sectionStep as Exclude<SectionName, 'ancestries' | 'options'>]
        } else if (featureData.__typename === 'FeatureSubfeature') {
          sections = featureData[sectionStep as Exclude<SectionName, 'ancestries' | 'options' | 'subfeatures'>]
        } else {
          sections = featureData[sectionStep as Exclude<SectionName, 'ancestries'>]
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
                      expandable={section.__typename === 'FeatureOption' || section.__typename === 'FeatureSubfeature'}
                    >
                      {(section.__typename === 'FeatureOption' || section.__typename === 'FeatureSubfeature') &&
                      section?.value != null
                        ? section?.label
                        : featureStep !== 'subfeature' && `${startCase(sectionStep)} ${sIndex + 1}`}
                    </Accordion.Header>
                    {(section.__typename === 'FeatureOption' || section.__typename === 'FeatureSubfeature') &&
                      (section.__typename === 'FeatureOption' || section.__typename === 'FeatureSubfeature') && (
                        <>
                          <Accordion.Content>
                            <div className={feature_description}>
                              {(section.__typename === 'FeatureOption' || section.__typename === 'FeatureSubfeature') &&
                                section?.desc &&
                                parse(section?.desc)}
                            </div>
                          </Accordion.Content>

                          <Accordion.Footer>
                            <Group justifyContentVariant='start'>
                              {sectionSteps.map(
                                (
                                  fSectionStep: Exclude<SectionName, 'ancestries' | 'options' | 'subfeatures'>,
                                  fSIndex
                                ) => {
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
                                }
                              )}
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
