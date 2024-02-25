import { FC, useState, useReducer, useEffect, useCallback } from 'react'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { SerializedError } from '@reduxjs/toolkit'
import parse from 'html-react-parser'
import Button from '../Button/Button'
import FormFooter from './FormFooter'
import { useNavigate } from 'react-router-dom'
import FeatureContent from './FeatureContent'
import SectionContent from './SectionContent'
import {
  ReducerActionType,
  FormContext,
  StepName,
  SectionName,
} from '../../utils/types'
import {
  feature_description,
  feature_list,
  form_content,
  form_header,
} from './Form.css'
import formReducer from '../../hooks/useReducer'
import Accordion from '../Accordion/Accordion'
import ScrollArea from '../ScrollArea/ScrollArea'
import { getSectionNames } from './FormUtils'
import Group from '../Group/Group'
import { startCase, isEqual } from 'lodash'
import { sprinkles } from '../../css/sprinkles.css'

interface FeatureFormProps {
  state: any
  isFirstStep: boolean
  isLastStep: boolean
  setStepIndex: (arg: (i: number) => number) => void
  context: {
    type: 'edit' | 'create'
    title: string
  }
  setState: (arg: ReducerActionType) => void
  handleSubmit: () => Promise<void>
  update: (
    arg: any
  ) => Promise<{ data: any } | { error: FetchBaseQueryError | SerializedError }>
  setErrorMessage: (arg: string) => void
}

const FeatureForm: FC<FeatureFormProps> = ({
  state,
  isLastStep,
  isFirstStep,
  setStepIndex,
  context,
  setState,
  handleSubmit,
  update,
  setErrorMessage,
}) => {
  const navigate = useNavigate()

  const [formState, setFormState] = useReducer(formReducer, state)
  const [oldFormState, setOldFormState] = useState<any>(state)
  const [matches, setMatches] = useState<boolean>(false)
  const [featureState, setFeatureState] = useReducer(
    formReducer,
    context.title === 'feat' ? state : {}
  )
  const [featureIndex, setFeatureIndex] = useState<number>(0)
  const [optionState, setOptionState] = useReducer(formReducer, {})
  const [optionIndex, setOptionIndex] = useState<number>(0)
  const [sectionState, setSectionState] = useReducer(formReducer, {})
  const [sectionIndex, setSectionIndex] = useState<number>(0)
  const [formContext, setFormContext] = useState<FormContext>('')
  const [stepName, setStepName] = useState<StepName>(
    context.title === 'feat' ? 'FeatureContent' : ''
  )
  const [sectionName, setSectionName] = useState<SectionName>('')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  //Determine if changes made for warning in handleBack
  useEffect(() => {
    if (isEqual(formState, oldFormState)) {
      setMatches(true)
    } else {
      setMatches(false)
    }
  }, [formState, oldFormState])

  const toggle = (index: number) => {
    if (activeIndex === index) {
      return setActiveIndex(null)
    }
    setActiveIndex(index)
  }

  const handleReset = () => {
    return setFormState({
      type: 'reset',
      target: { value: oldFormState },
    })
    setMatches(true)
  }

  const handleAdd = () => {
    if (formState.feature?.length > 0) {
      setFeatureIndex(formState.feature.length)
    }
    setStepName('FeatureContent')
  }

  const handleRemove = (featureIndex: number) => {
    setFormState({
      type: 'removed',
      target: {
        name: `feature.${featureIndex}`,
      },
    })
  }

  const handleEdit = (featureIndexProp: number) => {
    const featureStateProp = formState.feature[featureIndexProp]
    setFeatureIndex(featureIndexProp)
    setFeatureState({
      type: 'reset',
      target: { value: featureStateProp },
    })
    setStepName('FeatureContent')
  }

  const handleForward = () => {
    if (stepName === 'SectionContent') {
      if (formContext === 'OptionContent') {
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
      return setStepName('FeatureContent')
    }
    if (formContext === 'OptionContent') {
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
      setFormContext('')
      return setStepName('FeatureContent')
    }
    if (stepName === 'FeatureContent') {
      if (context.title === 'feat') {
        setState({
          target: { value: formState },
        })
        return handleSubmit()
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
      return setStepName('')
    }
    setState({
      target: { value: formState },
    })
    if (!isLastStep) {
      return setStepIndex((i: number) => {
        return i + 1
      })
    }
    handleSubmit()
  }

  const handleBack = () => {
    if (stepName === '' && matches) {
      console.log('matches, alert')
    }
    if (isFirstStep) {
      return navigate(-1)
    }
    if (stepName === 'SectionContent') {
      setSectionState({
        type: 'reset',
        target: { value: {} },
      })
      return setStepName('FeatureContent')
    }
    if (formContext === 'OptionContent' && stepName === 'FeatureContent') {
      setOptionState({
        type: 'reset',
        target: { value: {} },
      })
      setFormContext('')
      return setStepName('FeatureContent')
    }
    if (stepName === 'FeatureContent') {
      setFeatureState({
        type: 'reset',
        target: { value: {} },
      })
      return setStepName('')
    }
    setStepIndex((i: number) => {
      if (i <= 0) {
        return i
      } else {
        return i - 1
      }
    })
  }

  const handleUpdate = useCallback(() => {
    if (matches) {
      return setErrorMessage('No changes made')
    }
    if (stepName === 'SectionContent') {
      if (formContext === 'OptionContent') {
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
    if (formContext === 'OptionContent') {
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
    if (stepName === 'FeatureContent') {
      if (context.title === 'feat') {
        setState({
          target: { value: formState },
        })
      } else {
        setFormState({
          target: {
            name: `feature.${featureIndex}`,
            value: featureState,
          },
        })
        return setState({
          target: {
            name: `feature.${featureIndex}`,
            value: featureState,
          },
        })
      }
    }
    setState({
      type: 'reset',
      target: { value: formState },
    })
    update(formState)
    setOldFormState(formState)
  }, [
    context.title,
    featureState,
    optionState,
    featureIndex,
    formContext,
    formState,
    sectionState,
    optionIndex,
    sectionIndex,
    sectionName,
    stepName,
    setState,
    update,
    matches,
    setErrorMessage,
  ])

  const sectionNames = getSectionNames()

  const component = () => {
    if (stepName === 'FeatureContent') {
      if (context.title === 'feat') {
        return (
          <FeatureContent
            state={state}
            context={context}
            setSectionName={setSectionName}
            setStepName={setStepName}
            formContext={formContext}
            setFormContext={setFormContext}
            featureState={state}
            setFeatureState={setState}
            setOptionIndex={setOptionIndex}
            setSectionState={setSectionState}
            setOptionState={setOptionState}
            handleForward={handleForward}
            handleUpdate={context.type === 'edit' ? handleUpdate : undefined}
          />
        )
      }
      if (formContext !== 'OptionContent') {
        return (
          <FeatureContent
            state={state}
            context={context}
            setSectionName={setSectionName}
            setStepName={setStepName}
            formContext={formContext}
            setFormContext={setFormContext}
            featureState={featureState}
            setFeatureState={setFeatureState}
            setOptionIndex={setOptionIndex}
            setSectionState={setSectionState}
            setOptionState={setOptionState}
            handleForward={handleForward}
            handleUpdate={context.type === 'edit' ? handleUpdate : undefined}
          />
        )
      }
      return (
        <FeatureContent
          state={state}
          context={{ type: context.type, title: 'option' }}
          setSectionName={setSectionName}
          setStepName={setStepName}
          formContext={formContext}
          setFormContext={setFormContext}
          featureState={optionState}
          setFeatureState={setOptionState}
          setSectionState={setSectionState}
          handleForward={handleForward}
          handleUpdate={context.type === 'edit' ? handleUpdate : undefined}
        />
      )
    }
    if (stepName === 'SectionContent') {
      return (
        <SectionContent
          state={state}
          sectionName={sectionName}
          featureState={
            formContext === 'OptionContent' ? optionState : featureState
          }
          setSectionState={setSectionState}
          setSectionIndex={setSectionIndex}
          sectionState={sectionState}
          sectionIndex={sectionIndex}
          handleForward={handleForward}
          handleUpdate={context.type === 'edit' ? handleUpdate : undefined}
          setStepName={setStepName}
        />
      )
    }
  }

  return (
    <>
      <h2 className={form_header}>
        {stepName === 'FeatureContent' ? 'Feature' : 'Features'}{' '}
        {featureState.value != null && `(${featureState.value})`}
        {formContext === 'OptionContent' &&
          optionState.value != null &&
          ` / Option (${optionState.value})`}
      </h2>
      {stepName !== '' ? (
        component()
      ) : (
        <>
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
                          handleRemove={() => handleRemove(featureIndex)}
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
          <FormFooter
            handleBack={handleBack}
            forwardLabel={
              stepName !== ''
                ? 'Finish'
                : isLastStep
                ? context.type === 'edit'
                  ? 'Add New'
                  : 'Submit'
                : 'Next'
            }
            handleReset={handleReset}
            handleForward={handleForward}
            backLabel={'Back'}
            handleUpdate={context.type === 'edit' ? handleUpdate : undefined}
          />
        </>
      )}
    </>
  )
}

export default FeatureForm
