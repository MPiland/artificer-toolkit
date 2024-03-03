import { useEffect, useRef, useState, useReducer } from 'react'
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
import { isEqual, startCase } from 'lodash'
import { sprinkles } from '../../css/sprinkles.css'
import { validate } from '../../utils/formValidation'
import formReducer from '../../hooks/useReducer'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../app/store'
import { useLocation, useNavigate } from 'react-router-dom'
import { clearBack } from '../../app/modalSlice'
import FormFooter from './FormFooter'

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
  handleUpdate: (arg?: any) => void
  featureStepName: FeatureStepName
  setFeatureStepName: (arg: FeatureStepName) => void
  isFirstStep: boolean
}

const FeatureForm = ({
  context,
  isLastStep,
  formState,
  setFormState,
  handleRemove,
  handleForward,
  handleBack,
  handleUpdate,
  featureStepName,
  setFeatureStepName,
  isFirstStep,
}: FeatureFormProps) => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  const [featureState, setFeatureState] = useReducer(
    formReducer,
    context.title === 'feat' ? formState : {}
  )
  const [oldFeatureState, setOldFeatureState] = useState<any>({})
  const [featureIndex, setFeatureIndex] = useState<number>(0)
  const [optionState, setOptionState] = useReducer(formReducer, {})
  const [oldOptionState, setOldOptionState] = useState<any>({})
  const [optionIndex, setOptionIndex] = useState<number>(0)
  const [sectionState, setSectionState] = useReducer(formReducer, {})
  const [oldSectionState, setOldSectionState] = useState<any>({})
  const [sectionIndex, setSectionIndex] = useState<number>(0)
  const [featureContext, setFeatureContext] = useState<FeatureContext>('')
  const [sectionName, setSectionName] = useState<SectionName>('')
  const [activeIndex, setActiveIndex] = useState<number | null>(
    context.type !== 'new' ? null : 0
  )

  const formStateClone = useRef(JSON.parse(JSON.stringify(formState)))

  const confirmBack = useSelector((state: RootState) => state.modal.back.status)

  useEffect(() => {
    if (confirmBack) {
      if (featureStepName === 'SectionContent') {
        setSectionState({ type: 'reset', target: { value: {} } })
        setOldSectionState({})
        setFeatureStepName('FeatureContent')
      } else if (featureContext === 'OptionContent') {
        setOptionState({ type: 'reset', target: { value: {} } })
        setOldOptionState({})
        setFeatureContext('')
      } else if (featureStepName === 'FeatureContent') {
        setFeatureState({ type: 'reset', target: { value: {} } })
        setOldFeatureState({})
        setFeatureStepName('')
      }
      dispatch(clearBack())
    }
  }, [
    confirmBack,
    dispatch,
    setFeatureState,
    setFeatureContext,
    setFeatureStepName,
    featureContext,
    featureStepName,
  ])

  useEffect(() => {
    if (formStateClone.current == null && formState) {
      formStateClone.current = JSON.parse(JSON.stringify(formState))
    }
  }, [formState])

  const toggle = (index: number) => {
    if (activeIndex === index) {
      return setActiveIndex(null)
    }
    setActiveIndex(index)
  }

  const handleAlert = () => {
    navigate(`/alert`, {
      state: {
        background: location,
      },
    })
  }

  const handleAdd = () => {
    if (formState.feature?.length > 0) {
      setFeatureIndex(formState.feature.length)
      setOldFeatureState({})
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
    setOldFeatureState(featureStateProp)
    setFeatureStepName('FeatureContent')
  }

  const handleSaveSection = () => {
    if (featureContext === 'OptionContent') {
      setOptionState({
        target: {
          name: `${sectionName}.${sectionIndex}`,
          value: sectionState,
        },
      })
      return (formStateClone.current.feature[featureIndex].option[sectionName][
        sectionIndex
      ] = sectionState)
    }
    if (context.title === 'feat') {
      setFormState({
        target: {
          name: `${sectionName}.${sectionIndex}`,
          value: sectionState,
        },
      })
      return (formStateClone.current[sectionName][sectionIndex] = sectionState)
    }
    setFeatureState({
      target: {
        name: `${sectionName}.${sectionIndex}`,
        value: sectionState,
      },
    })
    formStateClone.current.feature[featureIndex][sectionName][sectionIndex] =
      sectionState
  }

  const handleSaveOption = () => {
    if (context.title === 'feat') {
      setFormState({
        target: {
          name: `option.${optionIndex}`,
          value: optionState,
        },
      })
      formStateClone.current.option[optionIndex] = optionState
    } else {
      setFeatureState({
        target: {
          name: `option.${optionIndex}`,
          value: optionState,
        },
      })
    }
    formStateClone.current.feature[featureIndex].option[optionIndex] =
      optionState
  }

  const handleSaveFeature = () => {
    setFormState({
      target: {
        name: `feature.${featureIndex}`,
        value: featureState,
      },
    })
    formStateClone.current.feature[featureIndex] = featureState
  }

  const handleFeatureForward = async () => {
    const isValid = validate()
    if (featureStepName === 'SectionContent') {
      handleSaveSection()
      setSectionState({
        type: 'reset',
        target: {
          value: {},
        },
      })
      return setFeatureStepName('FeatureContent')
    }
    if (isValid) {
      if (featureContext === 'OptionContent') {
        handleSaveOption()
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
        handleSaveFeature()
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
      if (!isEqual(sectionState, oldSectionState)) {
        return handleAlert()
      }
      setSectionState({
        type: 'reset',
        target: { value: {} },
      })
      return setFeatureStepName('FeatureContent')
    } else if (featureContext === 'OptionContent') {
      if (!isEqual(optionState, oldOptionState)) {
        return handleAlert()
      }
      setOptionState({
        type: 'reset',
        target: { value: {} },
      })
      setFeatureContext('')
      return setFeatureStepName('FeatureContent')
    } else if (featureStepName === 'FeatureContent') {
      if (!isEqual(oldFeatureState, featureState)) {
        return handleAlert()
      }
      setFeatureState({
        type: 'reset',
        target: { value: {} },
      })
      return setFeatureStepName('')
    }
    handleBack()
  }

  const handleFeatureUpdate = () => {
    const isValid = validate()
    if (isValid) {
      if (featureStepName === 'SectionContent') {
        handleSaveSection()
      } else if (featureContext === 'OptionContent') {
        handleSaveOption()
      } else if (
        featureStepName === 'FeatureContent' &&
        context.title !== 'feat'
      ) {
        handleSaveFeature()
      }
      handleUpdate(formStateClone.current)
    }
  }

  const handleFeatureReset = () => {
    if (featureStepName === 'SectionContent') {
      setSectionState({ type: 'reset', target: { value: oldSectionState } })
    } else if (featureContext === 'OptionContent') {
      setOldOptionState({ type: 'reset', target: { value: oldOptionState } })
    } else if (featureStepName === 'FeatureContent') {
      setOldFeatureState({ type: 'reset', target: { value: oldFeatureState } })
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
            setOldOptionState={setOldOptionState}
            setOldSectionState={setOldSectionState}
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
            setOldOptionState={setOldOptionState}
            setOldSectionState={setOldSectionState}
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
          setOldOptionState={setOldOptionState}
          setOldSectionState={setOldSectionState}
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
                        itemId={featureItem.id ?? featureIndex}
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
        </>
      )}
      <FormFooter
        handleBack={handleFeatureBack}
        forwardLabel={
          featureStepName === '' ? (isLastStep ? 'Submit' : 'Next') : 'Finish'
        }
        handleReset={handleFeatureReset}
        handleForward={handleFeatureForward}
        backLabel={isFirstStep ? 'Cancel' : 'Back'}
        handleUpdate={handleFeatureUpdate}
      />
    </>
  )
}

export default FeatureForm
