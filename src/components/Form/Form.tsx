import {
  error_message,
  form_header,
  form_wrapper,
  success_message,
} from './Form.css'
import { SerializedError } from '@reduxjs/toolkit'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { useEffect, useReducer, useState, useRef } from 'react'
import { startCase } from 'lodash'
import ProgressBar from '../ProgressBar/ProgressBar'
import useIsLoading from '../../hooks/useIsLoading'
import Spinner from '../Spinner/Spinner'
import DetailForm from './DetailForm'
import AttributeForm from './AttributeForm'
import TraitForm from './TraitForm'
import FeatureForm from './FeatureForm'
import {
  FormContext,
  ReducerActionType,
  Steps,
  FeatureStepName,
  FeatureContext,
  SectionName,
} from '../../utils/types'
import ContainsForm from './ContainsForm'
import ProficiencyForm from './ProficiencyForm'
import EquipmentForm from './EquipmentForm'
import formReducer from '../../hooks/useReducer'
import { useNavigate } from 'react-router-dom'
import { validate } from '../../utils/formValidation'
import { isEqual } from 'lodash'
import FormFooter from './FormFooter'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../app/store'
import { clearBack } from '../../app/modalSlice'
import { useEventListener } from 'usehooks-ts'

interface FormProps {
  context: {
    type: FormContext
    title: string
  }
  handleSubmit: () => Promise<void>
  update: (
    arg: any
  ) => Promise<{ data: any } | { error: FetchBaseQueryError | SerializedError }>
  steps: Steps
  state: any
  setState: (arg: ReducerActionType) => void
  errorMessage: string | null
  successMessage: string | null
  setErrorMessage: (arg: string | null) => void
  setSuccessMessage: (arg: string | null) => void
  location: any
}

const Form = ({
  context,
  handleSubmit,
  update,
  steps,
  state,
  setState,
  errorMessage,
  successMessage,
  setErrorMessage,
  setSuccessMessage,
  location,
}: FormProps) => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isLoading = useIsLoading()

  const confirmBack = useSelector((state: RootState) => state.modal.back.status)

  const [stepIndex, setStepIndex] = useState<number>(0)
  const [isFirstStep, setIsFirstStep] = useState<boolean>(false)
  const [isLastStep, setIsLastStep] = useState<boolean>(false)
  const [formState, setFormState] = useReducer(formReducer, state)
  const [oldFormState, setOldFormState] = useState<any>(formState)
  const [matches, setMatches] = useState<boolean>(false)
  const [featureState, setFeatureState] = useReducer(
    formReducer,
    context.title === 'feat' ? formState : {}
  )
  const [featureIndex, setFeatureIndex] = useState<number>(0)
  const [optionState, setOptionState] = useReducer(formReducer, {})
  const [optionIndex, setOptionIndex] = useState<number>(0)
  const [sectionState, setSectionState] = useReducer(formReducer, {})
  const [sectionIndex, setSectionIndex] = useState<number>(0)
  const [featureContext, setFeatureContext] = useState<FeatureContext>('')
  const [featureStepName, setFeatureStepName] = useState<FeatureStepName>(
    context.title === 'feat' ? 'FeatureContent' : ''
  )
  const [sectionName, setSectionName] = useState<SectionName>('')

  const documentRef = useRef(document)

  useEventListener(
    'keypress',
    () => {
      if (successMessage !== null && !matches) {
        setSuccessMessage(null)
      }
      if (errorMessage) {
        setErrorMessage(null)
      }
    },
    documentRef
  )

  useEventListener(
    'mouseup',
    () => {
      if (successMessage !== null && !matches) {
        setSuccessMessage(null)
      }
      if (errorMessage) {
        setErrorMessage(null)
      }
    },
    documentRef
  )

  // Last/First Step
  useEffect(() => {
    if (stepIndex === 0) {
      setIsFirstStep(true)
    } else {
      setIsFirstStep(false)
    }
    if (stepIndex === steps.length - 1) {
      setIsLastStep(true)
    } else {
      setIsLastStep(false)
    }
  }, [stepIndex, steps.length])

  useEffect(() => {
    if (state && !formState) {
      setFormState({ type: 'reset', target: { value: state } })
    }
  }, [state, formState])

  //Determine if changes made for warning in handleBack
  useEffect(() => {
    if (isEqual(formState, oldFormState)) {
      setMatches(true)
    } else {
      setMatches(false)
    }
  }, [formState, oldFormState])

  useEffect(() => {
    if (confirmBack && featureStepName === '') {
      dispatch(clearBack())
      if (isFirstStep) {
        navigate(-1)
      } else {
        setFormState({
          type: 'reset',
          target: { value: oldFormState },
        })
        setStepIndex((i: number) => {
          if (i <= 0) {
            return i
          } else {
            return i - 1
          }
        })
      }
    }
  }, [
    confirmBack,
    dispatch,
    navigate,
    isFirstStep,
    setFormState,
    oldFormState,
    featureStepName,
  ])

  const handleAlert = () => {
    navigate(`/alert`, {
      state: {
        background: location,
      },
    })
  }

  const handleRemove = (name: string) => {
    setFormState({ type: 'removed', target: { name: name } })
  }

  const handleAdd = (name: string) => {
    setFormState({ type: 'added', target: { name: name } })
  }

  const handleReset = () => {
    setFormState({
      type: 'reset',
      target: { value: oldFormState },
    })
  }

  const handleForward = async () => {
    const isValid = validate()
    if (isValid) {
      setOldFormState(formState)
      if (!isLastStep) {
        return setStepIndex((i: number) => {
          return i + 1
        })
      }
      if (matches) {
        return setErrorMessage('No changes made')
      }
      setState({
        type: 'reset',
        target: {
          value: formState,
        },
      })
      await handleSubmit()
      navigate(-1)
    }
  }

  const handleBack = () => {
    if (!matches) {
      return handleAlert()
    }
    if (isFirstStep) {
      return navigate(-1)
    }
    if (!isFirstStep) {
      setStepIndex((i: number) => {
        if (i <= 0) {
          return i
        } else {
          return i - 1
        }
      })
    }
  }

  const handleUpdate = async () => {
    if (matches) {
      return setErrorMessage('No changes made')
    }
    const isValid = validate()
    if (isValid) {
      setState({
        type: 'reset',
        target: { value: formState },
      })
      await update(formState)
      setOldFormState(formState)
      if (isLastStep) {
        navigate(-1)
      }
    }
  }

  const commonProps = {
    context,
    formState,
    setFormState,
    handleRemove,
    handleAdd,
    handleReset,
    handleForward,
    handleBack,
    handleUpdate,
  }

  const featureProps = {
    isLastStep,
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
  }

  const formSteps = [
    {
      name: 'Details',
      content: <DetailForm {...commonProps} />,
    },
    {
      name: 'Attributes',
      content: <AttributeForm {...commonProps} />,
    },
    {
      name: 'Traits',
      content: <TraitForm {...commonProps} />,
    },
    {
      name: 'Features',
      content: <FeatureForm {...commonProps} {...featureProps} />,
    },
    {
      name: 'Contains',
      content: <ContainsForm {...commonProps} />,
    },
    {
      name: 'Proficiencies',
      content: <ProficiencyForm {...commonProps} />,
    },
    {
      name: 'Equipment',
      content: <EquipmentForm {...commonProps} />,
    },
  ]

  return (
    <form className={form_wrapper}>
      {steps.length > 1 && (
        <ProgressBar currentStepIndex={stepIndex} steps={steps} />
      )}
      <div className={form_header}>
        <h1>
          {`${context.type === 'new' ? 'Create' : startCase(context.type)} ${
            context.title === 'item' ? ' An ' : ' A '
          }`}
          {startCase(context.title)}
          {state?.value && ` (${state.value})`}
          {errorMessage && (
            <span className={error_message}> - {errorMessage}</span>
          )}
          {successMessage && (
            <span className={success_message}> - {successMessage}</span>
          )}
        </h1>
      </div>
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          {
            formSteps[
              formSteps.findIndex((step) => step.name === steps[stepIndex])
            ].content
          }
          {featureStepName === '' && (
            <FormFooter
              handleBack={handleBack}
              forwardLabel={
                isLastStep
                  ? context.type === 'edit'
                    ? 'Update'
                    : 'Submit'
                  : 'Next'
              }
              handleReset={handleReset}
              handleForward={
                context.type === 'edit' && isLastStep
                  ? handleUpdate
                  : handleForward
              }
              backLabel={isFirstStep ? 'Cancel' : 'Back'}
              handleUpdate={
                context.type === 'edit' && !isLastStep
                  ? handleUpdate
                  : undefined
              }
            />
          )}
        </>
      )}
    </form>
  )
}

export default Form
