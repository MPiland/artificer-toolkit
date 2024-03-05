import {
  error_message,
  form_header,
  form_wrapper,
  success_message,
} from './Form.css'
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
import { clearBack, clearForward } from '../../app/modalSlice'
import { useEventListener } from 'usehooks-ts'
import {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
  TypedUseMutation,
} from '@reduxjs/toolkit/query/react'

interface FormProps {
  context: {
    type: FormContext
    title: string
  }
  steps: Steps
  state: any
  setState: (arg: ReducerActionType) => void
  location: any
  useAddNewItem: TypedUseMutation<
    any,
    any,
    BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>
  >
  useUpdateItem: TypedUseMutation<
    any,
    any,
    BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>
  >
}

const Form = ({
  context,
  steps,
  state,
  setState,
  location,
  useAddNewItem,
  useUpdateItem,
}: FormProps) => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isLoading = useIsLoading()

  const confirmBack = useSelector((state: RootState) => state.modal.back)
  const confirmForward = useSelector((state: RootState) => state.modal.forward)

  const [
    addNewItem,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewItem()

  const [
    updateItem,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateItem()

  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [isFirstStep, setIsFirstStep] = useState<boolean>(false)
  const [isLastStep, setIsLastStep] = useState<boolean>(false)
  const [formState, setFormState] = useReducer(formReducer, state)
  const [oldFormState, setOldFormState] = useState<any>(formState)
  const [featureStepName, setFeatureStepName] = useState<FeatureStepName>(
    context.title === 'feat' ? 'FeatureContent' : ''
  )
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

  const documentRef = useRef(document)

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

  useEffect(() => {
    if (confirmBack.status && featureStepName === '') {
      dispatch(clearBack())
      if (isFirstStep) {
        navigate(-1)
      } else {
        setFormState({
          type: 'reset',
          target: { value: oldFormState },
        })
        if (String(confirmBack.index) && confirmBack.index != null) {
          setStepIndex(confirmBack.index)
        } else {
          setStepIndex((i: number) => {
            if (i <= 0) {
              return i
            } else {
              return i - 1
            }
          })
        }
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

  useEffect(() => {
    if (confirmForward.status && featureStepName === '') {
      dispatch(clearForward())
      if (!isLastStep && confirmForward.index) {
        setFormState({
          type: 'reset',
          target: { value: oldFormState },
        })
        setStepIndex(confirmForward.index)
      }
    }
  }, [
    confirmForward,
    dispatch,
    navigate,
    isLastStep,
    setFormState,
    oldFormState,
    featureStepName,
  ])

  useEffect(() => {
    if (addIsSuccess || updateIsSuccess) {
      setSuccessMessage(
        `${startCase(context.title)} ${
          context.type === 'edit' ? 'updated' : 'added'
        } successfully!`
      )
      setErrorMessage(null)
    }
  }, [
    addIsSuccess,
    updateIsSuccess,
    context.type,
    context.title,
    setErrorMessage,
    setSuccessMessage,
  ])

  useEffect(() => {
    if (addIsError || updateIsError) {
      if (addError && 'data' in addError) {
        setErrorMessage((addError.data as any).message)
      }
      if (updateError && 'data' in updateError) {
        setErrorMessage((updateError.data as any).message)
      }
    }
  }, [
    addIsSuccess,
    updateIsSuccess,
    context.type,
    context.title,
    setErrorMessage,
    setSuccessMessage,
    addIsError,
    updateIsError,
    addError,
    updateError,
  ])

  const handleAlert = (alertContext: string, alertIndex?: number) => {
    navigate(`/alert`, {
      state: {
        background: location,
        context: alertContext,
        index: alertIndex,
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

  const handleSubmit = async (formState: any) => {
    await addNewItem(formState)
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
      setState({
        type: 'reset',
        target: {
          value: formState,
        },
      })
      await handleSubmit(formState)
      navigate(-1)
    }
  }

  const handleBack = () => {
    if (!isEqual(oldFormState, formState)) {
      return handleAlert('back')
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

  const handleUpdate = async (formStateProp?: any) => {
    const isValid = validate()
    if (formStateProp != null) {
      if (isEqual(oldFormState, formStateProp)) {
        return setErrorMessage('No changes made')
      }
      setState({
        type: 'reset',
        target: { value: formStateProp },
      })
      setOldFormState(formStateProp)
      return await updateItem(formStateProp)
    }
    if (isEqual(oldFormState, formState)) {
      return setErrorMessage('No changes made')
    }
    if (isValid) {
      setState({
        type: 'reset',
        target: { value: formState },
      })
      setOldFormState(formState)
      await updateItem(formState)
    }
  }

  const handleStepChange = (progressStepIndex: number) => {
    if (featureStepName !== '') {
      setSectionState({ type: 'reset', target: { value: {} } })
      setOldSectionState({})
      setFeatureState({ type: 'reset', target: { value: {} } })
      setOldFeatureState({})
      setOptionState({ type: 'reset', target: { value: {} } })
      setOldOptionState({})
      setFeatureStepName('')
    }
    if (!isEqual(oldFormState, formState)) {
      if (progressStepIndex < stepIndex) {
        return handleAlert('back', progressStepIndex)
      } else {
        return handleAlert('forward', progressStepIndex)
      }
    }
    setStepIndex(progressStepIndex)
  }

  useEventListener(
    'keypress',
    () => {
      if (successMessage !== null) {
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
      if (successMessage !== null) {
        setSuccessMessage(null)
      }
      if (errorMessage) {
        setErrorMessage(null)
      }
    },
    documentRef
  )

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
    isFirstStep,
    featureStepName,
    setFeatureStepName,
    formState,
    featureState,
    setFeatureState,
    oldFeatureState,
    setOldFeatureState,
    featureIndex,
    setFeatureIndex,
    optionState,
    setOptionState,
    oldOptionState,
    setOldOptionState,
    optionIndex,
    setOptionIndex,
    sectionState,
    setSectionState,
    oldSectionState,
    setOldSectionState,
    sectionIndex,
    setSectionIndex,
    featureContext,
    setFeatureContext,
    sectionName,
    setSectionName,
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
        <ProgressBar
          currentStepIndex={stepIndex}
          steps={steps}
          handleStepChange={handleStepChange}
        />
      )}
      <div className={form_header}>
        <h1>
          {`${context.type === 'new' ? 'Create' : startCase(context.type)} ${
            context.title === 'item' ? ' An ' : ' A '
          }`}
          {startCase(context.title)}
          {formState?.value && ` (${formState.value})`}
        </h1>
        {errorMessage && <span className={error_message}>{errorMessage}</span>}
        {successMessage && (
          <span className={success_message}>{successMessage}</span>
        )}
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
          {formSteps[
            formSteps.findIndex((step) => step.name === steps[stepIndex])
          ].name !== 'Features' && (
            <FormFooter
              handleBack={handleBack}
              forwardLabel={
                isLastStep
                  ? context.type === 'edit'
                    ? 'Add New'
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
