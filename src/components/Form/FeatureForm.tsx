import { useState } from 'react'
import parse from 'html-react-parser'
import Button from '../Button/Button'
import FeatureContent from './FeatureContent'
import SectionContent from './SectionContent'
import {
  ReducerActionType,
  FeatureContext,
  FeatureStepName,
  SectionName,
  FormContext,
} from '../../utils/types'
import {
  feature_description,
  feature_list,
  form_content,
  form_header,
} from './Form.css'
import Accordion from '../Accordion/Accordion'
import ScrollArea from '../ScrollArea/ScrollArea'
import { getSectionNames } from './FormUtils'
import Group from '../Group/Group'
import { startCase } from 'lodash'
import { sprinkles } from '../../css/sprinkles.css'
import { validate } from '../../utils/formValidation'

interface FeatureFormProps {
  context: {
    type: FormContext
    title: string
  }
  isLastStep?: boolean
  formState: any
  setFormState: (arg: ReducerActionType) => void
  handleRemove: (arg: string) => void
  handleReset: () => void
  handleForward: () => void
  handleBack: () => void
  handleUpdate: () => void
  featureState: any
  setFeatureState: (arg: ReducerActionType) => void
  featureIndex: number
  setFeatureIndex: (arg: number) => void
  optionState: any
  setOptionState: (arg: ReducerActionType) => void
  optionIndex: number
  setOptionIndex: (arg: number) => void
  sectionState: any
  setSectionState: (arg: ReducerActionType) => void
  sectionIndex: number
  setSectionIndex: (arg: number) => void
  sectionName: SectionName
  setSectionName: (arg: SectionName) => void
  featureContext: FeatureContext
  setFeatureContext: (arg: FeatureContext) => void
  featureStepName: FeatureStepName
  setFeatureStepName: (arg: FeatureStepName) => void
}

const FeatureForm = ({
  context,
  formState,
  setFormState,
  handleRemove,
  handleForward,
  handleBack,
  handleUpdate,
  featureState,
  setFeatureState,
  featureIndex,
  setFeatureIndex,
  optionState,
  setOptionState,
  optionIndex,
  setOptionIndex,
  sectionState,
  setSectionState,
  sectionIndex,
  setSectionIndex,
  sectionName,
  setSectionName,
  featureContext,
  setFeatureContext,
  featureStepName,
  setFeatureStepName,
}: FeatureFormProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(
    context.type !== 'new' ? null : 0
  )

  const toggle = (index: number) => {
    if (activeIndex === index) {
      return setActiveIndex(null)
    }
    setActiveIndex(index)
  }

  const handleAdd = () => {
    if (formState.feature?.length > 0) {
      setFeatureIndex(formState.feature.length)
    }
    setFeatureStepName('FeatureContent')
  }

  const handleEdit = (featureIndexProp: number) => {
    const featureStateProp = formState.feature[featureIndexProp]
    setFeatureIndex(featureIndexProp)
    setFeatureState({
      type: 'reset',
      target: { value: featureStateProp },
    })
    setFeatureStepName('FeatureContent')
  }

  const handleFeatureForward = async () => {
    const isValid = validate()
    {
      if (isValid)
        if (featureStepName === 'SectionContent') {
          if (featureContext === 'OptionContent') {
            setOptionState({
              target: {
                name: `${sectionName}.${sectionIndex}`,
                value: sectionState,
              },
            })
          } else {
            if (context.title === 'feat') {
              setFormState({
                target: {
                  name: `${sectionName}.${sectionIndex}`,
                  value: sectionState,
                },
              })
            } else {
              setFeatureState({
                target: {
                  name: `${sectionName}.${sectionIndex}`,
                  value: sectionState,
                },
              })
            }
          }
          setSectionState({
            type: 'reset',
            target: {
              value: {},
            },
          })
          return setFeatureStepName('FeatureContent')
        }
      if (featureContext === 'OptionContent') {
        if (context.title === 'feat') {
          setFormState({
            target: {
              name: `option.${optionIndex}`,
              value: optionState,
            },
          })
        } else {
          setFeatureState({
            target: {
              name: `option.${optionIndex}`,
              value: optionState,
            },
          })
        }
        setOptionState({
          type: 'reset',
          target: {
            value: {},
          },
        })
        setFeatureContext('')
        return setFeatureStepName('FeatureContent')
      }
      if (featureStepName === 'FeatureContent') {
        if (context.title === 'feat') {
          setFormState({
            type: 'reset',
            target: { value: formState },
          })
        }
        setFormState({
          target: {
            name: `feature.${featureIndex}`,
            value: featureState,
          },
        })
        setFeatureState({
          type: 'reset',
          target: {
            value: {},
          },
        })
        return setFeatureStepName('')
      }
      handleForward()
    }
  }

  const handleFeatureBack = () => {
    if (featureStepName === 'SectionContent') {
      setSectionState({
        type: 'reset',
        target: { value: {} },
      })
      return setFeatureStepName('FeatureContent')
    }
    if (featureStepName === 'FeatureContent') {
      if (featureContext === 'OptionContent') {
        setOptionState({
          type: 'reset',
          target: { value: {} },
        })
        setFeatureContext('')
        return setFeatureStepName('FeatureContent')
      }
      setFeatureState({
        type: 'reset',
        target: { value: {} },
      })
      return setFeatureStepName('')
    }
    handleBack()
  }

  const handleFeatureUpdate = async () => {
    const isValid = validate()
    if (isValid) {
      if (featureStepName === 'SectionContent') {
        if (featureContext === 'OptionContent') {
          setOptionState({
            target: {
              name: `${sectionName}.${sectionIndex}`,
              value: sectionState,
            },
          })
        } else if (context.title === 'feat') {
          setFormState({
            target: {
              name: `${sectionName}.${sectionIndex}`,
              value: sectionState,
            },
          })
        } else {
          setFeatureState({
            target: {
              name: `${sectionName}.${sectionIndex}`,
              value: sectionState,
            },
          })
        }
      }
      if (featureContext === 'OptionContent') {
        if (context.title === 'feat') {
          setFormState({
            target: {
              name: `option.${optionIndex}`,
              value: optionState,
            },
          })
        } else {
          setFeatureState({
            target: {
              name: `option.${optionIndex}`,
              value: optionState,
            },
          })
        }
      }
      if (featureStepName === 'FeatureContent') {
        if (context.title === 'feat') {
          return setFormState({
            type: 'reset',
            target: { value: formState },
          })
        } else {
          return setFormState({
            target: {
              name: `feature.${featureIndex}`,
              value: featureState,
            },
          })
        }
      }
      handleUpdate()
    }
  }

  const sectionNames = getSectionNames()

  const component = () => {
    if (featureStepName === 'FeatureContent') {
      if (context.title === 'feat') {
        return (
          <FeatureContent
            state={formState}
            context={context}
            setSectionName={setSectionName}
            setFeatureStepName={setFeatureStepName}
            featureContext={featureContext}
            setFeatureContext={setFeatureContext}
            featureState={formState}
            setFeatureState={setFormState}
            setOptionIndex={setOptionIndex}
            setSectionState={setSectionState}
            setOptionState={setOptionState}
            handleFeatureBack={handleFeatureBack}
            handleFeatureForward={handleFeatureForward}
            handleFeatureUpdate={
              context.type === 'edit' ? handleFeatureUpdate : undefined
            }
          />
        )
      }
      if (featureContext !== 'OptionContent') {
        return (
          <FeatureContent
            state={formState}
            context={context}
            setSectionName={setSectionName}
            setFeatureStepName={setFeatureStepName}
            featureContext={featureContext}
            setFeatureContext={setFeatureContext}
            featureState={featureState}
            setFeatureState={setFeatureState}
            setOptionIndex={setOptionIndex}
            setSectionState={setSectionState}
            setOptionState={setOptionState}
            handleFeatureBack={handleFeatureBack}
            handleFeatureForward={handleFeatureForward}
            handleFeatureUpdate={
              context.type === 'edit' ? handleFeatureUpdate : undefined
            }
          />
        )
      }
      return (
        <FeatureContent
          state={formState}
          context={{ type: context.type, title: 'option' }}
          setSectionName={setSectionName}
          setFeatureStepName={setFeatureStepName}
          featureContext={featureContext}
          setFeatureContext={setFeatureContext}
          featureState={optionState}
          setFeatureState={setOptionState}
          setSectionState={setSectionState}
          handleFeatureBack={handleFeatureBack}
          handleFeatureForward={handleFeatureForward}
          handleFeatureUpdate={
            context.type === 'edit' ? handleFeatureUpdate : undefined
          }
        />
      )
    }
    if (featureStepName === 'SectionContent') {
      return (
        <SectionContent
          state={formState}
          sectionName={sectionName}
          featureState={
            featureContext === 'OptionContent' ? optionState : featureState
          }
          setSectionState={setSectionState}
          setSectionIndex={setSectionIndex}
          sectionState={sectionState}
          sectionIndex={sectionIndex}
          handleFeatureBack={handleFeatureBack}
          handleFeatureForward={handleFeatureForward}
          handleFeatureUpdate={
            context.type === 'edit' ? handleFeatureUpdate : undefined
          }
        />
      )
    }
  }

  return (
    <>
      <h2 className={form_header}>
        {featureStepName === 'FeatureContent' ? 'Feature' : 'Features'}{' '}
        {featureState.value != null && `(${featureState.value})`}
        {featureContext === 'OptionContent' &&
          optionState.value != null &&
          ` / Option (${optionState.value})`}
      </h2>
      {featureStepName !== '' ? (
        component()
      ) : (
        <ScrollArea scrollDirection='vertical' className={form_content}>
          <Button variant='primary' onClick={handleAdd}>
            Add Feature
          </Button>
          {formState.feature?.length > 0 && (
            <div className={feature_list}>
              <Accordion
                dataArray={formState.feature}
                setState={setFormState}
                name='feature'
              >
                {formState.feature?.map(
                  (featureItem: any, featureIndex: number) => (
                    <Accordion.Container
                      key={featureIndex}
                      itemId={featureItem.id}
                    >
                      <Accordion.Header
                        handleClick={() => toggle(featureIndex)}
                        handleRemove={() =>
                          handleRemove(`feature.${featureIndex}`)
                        }
                        handleEdit={() => handleEdit(featureIndex)}
                        active={
                          !featureItem.desc
                            ? null
                            : activeIndex === featureIndex
                        }
                      >
                        {featureItem.value != null && featureItem.value !== ''
                          ? featureItem.value
                          : `Feature ${featureIndex + 1}`}
                      </Accordion.Header>
                      {featureItem.desc && (
                        <Accordion.Content
                          active={activeIndex === featureIndex}
                        >
                          <div className={feature_description}>
                            {featureItem.desc && parse(featureItem.desc)}
                          </div>
                        </Accordion.Content>
                      )}
                      <hr />
                      <Accordion.Footer>
                        <Group justifyContentVariant='start'>
                          {sectionNames.map(
                            (sectionName: string, sectionIndex: number) => {
                              return (
                                <span
                                  key={sectionIndex}
                                  className={sprinkles({ me: 'size-2' })}
                                >
                                  {featureItem[sectionName]?.length > 0 ? (
                                    <strong>
                                      {startCase(sectionName.charAt(0))}:{' '}
                                      {featureItem[sectionName]?.length}
                                    </strong>
                                  ) : (
                                    `${startCase(sectionName.charAt(0))}: 0`
                                  )}
                                </span>
                              )
                            }
                          )}
                        </Group>
                      </Accordion.Footer>
                    </Accordion.Container>
                  )
                )}
              </Accordion>
            </div>
          )}
        </ScrollArea>
      )}
    </>
  )
}

export default FeatureForm
