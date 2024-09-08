import { ReducerActionType, SectionNameType } from '../../../../utils/types'
import Accordion from '../../../Accordion/Accordion'
import Group from '../../../Group/Group'
import { sprinkles } from '../../../../css/sprinkles.css'
import { startCase } from 'lodash'
import { feature_description } from '../../Form.css'
import parse from 'html-react-parser'
import { useFeature } from '../../../../hooks/UseFeature'

const SectionsList = ({ state, setState }: { state: any; setState: (arg: ReducerActionType) => void }) => {
  const {
    subContext,
    setSubContext,
    setSubfeatureState,
    setSubfeatureIndex,
    setOldSubfeatureState,
    sectionNames,
    setSectionIndex,
    setSectionName,
    setSectionState,
    setOldSectionState,
    setOptionState,
    setOldOptionState,
    setOptionIndex,
  } = useFeature()

  const handleRemove = (sectionName: SectionNameType, sectionIndex: number) => {
    setState({
      type: 'removed',
      target: { name: `${sectionName}.${sectionIndex}` },
    })
  }

  const handleEdit = (sectionName: SectionNameType, sectionIndex: number, sectionItem: any) => {
    setSectionIndex(sectionIndex)
    if (sectionName === 'options' || sectionName === 'features') {
      if (subContext === 'option') {
        setSubfeatureState({
          type: 'reset',
          target: { value: sectionItem },
        })
        setSubfeatureIndex(sectionIndex)
        setOldSubfeatureState(sectionItem)
        return setSubContext('subfeature')
      }
      setOptionState({
        type: 'reset',
        target: { value: sectionItem },
      })
      setOptionIndex(sectionIndex)
      setOldOptionState(sectionItem)
      return setSubContext('option')
    }
    setSectionName(sectionName)
    setSectionState({
      type: 'reset',
      target: { value: sectionItem },
    })
    console.log({ sectionItem })
    setOldSectionState(sectionItem)
  }

  return (
    <>
      {sectionNames.map((sectionName, sectionNameIndex: number) => {
        return (
          state[sectionName]?.length > 0 && (
            <Accordion
              key={sectionNameIndex}
              dataArray={state[sectionName]}
              setState={setState}
              name={sectionName}
              disableSort={sectionName !== 'options' && sectionName !== 'features'}
            >
              {state[sectionName]?.map((sectionItem: any, sectionIndex: number) => {
                return (
                  <Accordion.Wrapper key={sectionIndex} itemId={String(sectionIndex)}>
                    <Accordion.Header
                      key={sectionIndex}
                      handleRemove={() => handleRemove(sectionName, sectionIndex)}
                      handleEdit={() => handleEdit(sectionName, sectionIndex, sectionItem)}
                    >
                      {sectionName !== 'features' && `${startCase(sectionName)} ${sectionIndex + 1}`}
                      {sectionItem?.value != null && sectionItem?.value !== '' && sectionName === 'options'
                        ? ` (${sectionItem?.value})`
                        : sectionItem?.value}
                    </Accordion.Header>
                    {(sectionName === 'options' || sectionName === 'features') && (
                      <>
                        <Accordion.Content>
                          <div className={feature_description}>{sectionItem?.desc && parse(sectionItem?.desc)}</div>
                        </Accordion.Content>
                        <Accordion.Footer>
                          <Group justifyContentVariant='start'>
                            {sectionNames.map((footerSectionName: string, footerSectionIndex: number) => {
                              return (
                                <span
                                  key={footerSectionIndex}
                                  className={sprinkles({
                                    me: 'space-3',
                                  })}
                                >
                                  {sectionItem[footerSectionName]?.length > 0 ? (
                                    <strong key={footerSectionIndex}>
                                      {startCase(footerSectionName.charAt(0))}:{sectionItem[footerSectionName]?.length}
                                    </strong>
                                  ) : (
                                    `${startCase(footerSectionName.charAt(0))}: 0`
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
