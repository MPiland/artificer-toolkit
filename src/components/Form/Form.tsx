import {
  error_message,
  form_header,
  form_wrapper,
  success_message,
} from './Form.css'
import { useEffect, useReducer, useState, useRef } from 'react'
import { set, startCase } from 'lodash'
import ProgressBar from './ProgressBar'
import useIsLoading from '../../hooks/useIsLoading'
import Spinner from '../Spinner/Spinner'
import DetailForm from './DetailForm'
import AttributeForm from './AttributeForm'
import TraitForm from './TraitForm'
import FeatureForm from './FeatureForm'
import {
  FormContext,
  ReducerActionType,
  Step,
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
  steps: Step[]
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

  const [
    addNewItem,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewItem()

  const [
    updateItem,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateItem()

  const [saving, setSaving] = useState<boolean>(false)
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
  const [stepName, setStepName] = useState<Step>(steps[stepIndex])

  const documentRef = useRef(document)

  useEffect(() => {
    setStepName(steps[stepIndex])
  }, [stepIndex, steps])

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

  // Set formState
  useEffect(() => {
    if (state && !formState) {
      setFormState({ type: 'reset', target: { value: state } })
    }
  }, [state, formState])

  // Confirm Alert back
  useEffect(() => {
    if (confirmBack.status) {
      dispatch(clearBack())
      navigate(-1)
    }
  }, [confirmBack.status, dispatch, navigate])

  // Sucess Message
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

  // Error Message
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

  useEffect(() => {
    if (
      formState?.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'ancestryOptions'
      ) &&
      !steps.includes('Ancestry')
    ) {
      steps.splice(2, 0, 'Ancestry')
    }
    if (
      !formState?.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'ancestryOptions'
      ) &&
      steps.includes('Ancestry')
    ) {
      const index = steps.indexOf('Ancestry')
      steps.splice(index, 1)
    }
  }, [formState.attribute, steps])

  const handleAlert = ({
    context,
    message,
  }: {
    context: string
    message: string
  }) => {
    navigate(`/alert`, {
      state: {
        background: location,
        context: context,
        message: message,
      },
    })
  }

  // Save section form state
  const handleSaveFeatureSection = (clone?: any) => {
    const formClone = clone ? JSON.parse(JSON.stringify(clone)) : {}
    const arrayName = stepName === 'Ancestry' ? 'ancestry.option' : 'feature'
    const subArrayName = stepName === 'Ancestry' ? 'feature' : 'option'
    setOldSectionState(sectionState)
    if (context.title === 'feat') {
      if (featureContext === 'OptionContent') {
        const objectPath = `option.${optionIndex}.${sectionName}.${sectionIndex}`
        setFormState({
          target: {
            name: objectPath,
            value: sectionState,
          },
        })
        const arrayPath = objectPath.split('.')
        set(formClone, arrayPath, sectionState)
        return formClone
      }
      const objectPath = `${sectionName}.${sectionIndex}`
      setFormState({
        target: {
          name: objectPath,
          value: sectionState,
        },
      })
      const arrayPath = objectPath.split('.')
      set(formClone, arrayPath, sectionState)
      return formClone
    }
    if (featureContext === 'OptionContent') {
      const objectPath = `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}.${sectionName}.${sectionIndex}`
      setOptionState({
        target: {
          name: `${subArrayName}.${optionIndex}.${sectionName}.${sectionIndex}`,
          value: sectionState,
        },
      })
      const arrayPath = objectPath.split('.')
      set(formClone, arrayPath, sectionState)
      return formClone
    }
    const objectPath = `${arrayName}.${featureIndex}.${sectionName}.${sectionIndex}`
    setFeatureState({
      target: {
        name: `${sectionName}.${sectionIndex}`,
        value: sectionState,
      },
    })
    const arrayPath = objectPath.split('.')
    set(formClone, arrayPath, sectionState)
    return formClone
  }

  // Save option form state
  const handleSaveFeatureOption = (clone?: any) => {
    const formClone = clone ? JSON.parse(JSON.stringify(clone)) : {}
    const arrayName = stepName === 'Ancestry' ? 'ancestry.option' : 'feature'
    const subArrayName = stepName === 'Ancestry' ? 'feature' : 'option'

    setOldOptionState(featureState)
    if (context.title === 'feat') {
      const objectPath = `option.${optionIndex}`
      setFormState({
        target: {
          name: objectPath,
          value: optionState,
        },
      })
      const arrayPath = objectPath.split('.')
      set(formClone, arrayPath, optionState)
      return formClone
    }
    const objectPath = `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`
    setFeatureState({
      target: {
        name: `${subArrayName}.${optionIndex}`,
        value: optionState,
      },
    })
    const arrayPath = objectPath.split('.')
    set(formClone, arrayPath, optionState)
    return formClone
  }

  // Save feature form state
  const handleSaveFeature = (clone?: any) => {
    const formClone = clone ? JSON.parse(JSON.stringify(clone)) : {}
    const arrayName = stepName === 'Ancestry' ? 'ancestry.option' : 'feature'
    const objectPath = `${arrayName}.${featureIndex}`

    setOldFeatureState(featureState)
    setFormState({
      target: {
        name: objectPath,
        value: featureState,
      },
    })
    const arrayPath = objectPath.split('.')
    set(formClone, arrayPath, featureState)
    return formClone
  }

  const handleUpdateFeature = () => {
    let formClone = JSON.parse(JSON.stringify(formState))
    if (
      featureStepName === 'SectionContent' &&
      !isEqual(oldSectionState, sectionState)
    ) {
      return (formClone = handleSaveFeatureSection(formClone))
    }
    if (
      featureContext === 'OptionContent' &&
      !isEqual(oldOptionState, optionState)
    ) {
      return (formClone = handleSaveFeatureOption(formClone))
    }
    if (
      featureStepName === 'FeatureContent' &&
      !isEqual(oldFeatureState, featureState)
    ) {
      return (formClone = handleSaveFeature(formClone))
    }
  }

  // Save feature hierachy and clear states
  const handleSave = () => {
    if (featureStepName === 'SectionContent') {
      if (context.title === 'feat') {
        setFormState({
          target: {
            name: `${sectionName}.${sectionIndex}`,
            value: sectionState,
          },
        })
      } else if (featureContext === 'OptionContent') {
        setOptionState({
          target: {
            name: `${sectionName}.${sectionIndex}`,
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
      return setFeatureStepName('FeatureContent')
    }
    if (featureContext === 'OptionContent') {
      const parentName = stepName === 'Ancestry' ? 'feature' : 'option'
      if (context.title === 'feat') {
        setFormState({
          target: {
            name: `option.${optionIndex}`,
            value: optionState,
          },
        })
      }
      setFeatureState({
        target: {
          name: `${parentName}.${optionIndex}`,
          value: optionState,
        },
      })
      setFeatureContext('')
      return setFeatureStepName('FeatureContent')
    }
    if (featureStepName === 'FeatureContent') {
      if (context.title !== 'feat') {
        const parentName =
          stepName === 'Ancestry' ? 'ancestry.option' : 'feature'
        setFormState({
          target: {
            name: `${parentName}.${featureIndex}`,
            value: featureState,
          },
        })
      }
      return setFeatureStepName('')
    }
    /* Form Saving */
    setOldFormState(formState)
  }

  console.log('sectionIndex', sectionIndex)

  const handleForward = async () => {
    const isValid = validate()
    if (isValid) {
      if (featureStepName !== '') {
        console.log({ featureStepName: featureStepName })
        return handleSave()
      }
      setOldFormState(formState)
      setStepIndex((prev: number) => prev + 1)
    }
    if (isLastStep && featureStepName === '') {
      setSaving(true)
      await addNewItem(formState)
      setSaving(false)
      navigate(-1)
    }
  }

  const handleBack = () => {
    const isValid = validate()
    if (isFirstStep) {
      if (!isEqual(state, formState)) {
        return handleAlert({
          context: 'back',
          message:
            context.type === 'edit'
              ? `Changes have not been saved. Press 'Cancel' and then 'Update' to save changes. Otherwise, press 'Continue'`
              : `${startCase(
                  context.title
                )} has not been created. Press 'Cancel' and then 'Create' at end of form to save. Otherwise, press 'Continue'.`,
        })
      }
      return navigate(-1)
    }
    if (!isFirstStep) {
      if (featureStepName !== '') {
        if (featureStepName === 'SectionContent') {
          if (isEqual(sectionState, oldSectionState)) {
            return setFeatureStepName('FeatureContent')
          }
          if (isValid) {
            handleSaveFeatureSection()
            return setFeatureStepName('FeatureContent')
          }
        }
        if (featureContext === 'OptionContent') {
          if (isEqual(optionState, oldOptionState)) {
            return setFeatureContext('')
          }
          if (isValid) {
            handleSaveFeatureOption()
            return setFeatureContext('')
          }
        }
        if (featureStepName === 'FeatureContent') {
          if (isEqual(featureState, oldFeatureState)) {
            return setFeatureStepName('')
          }
          if (isValid) {
            handleSaveFeature()
            return setFeatureStepName('')
          }
        }
      }
      if (isEqual(oldFormState, formState)) {
        if (isFirstStep) {
          return navigate(-1)
        }
      }
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
    const isValid = validate()
    if (isValid) {
      if (featureStepName !== '') {
        const formClone = handleUpdateFeature()
        if (isEqual(oldFormState, formClone)) {
          return setErrorMessage('No changes made')
        }
        setFormState({
          type: 'reset',
          target: { value: formClone },
        })
        setState({
          type: 'reset',
          target: { value: formClone },
        })
        console.log({ formClone: formClone })
        await updateItem(formClone)
        return setOldFormState(formClone)
      }
      if (isEqual(oldFormState, formState)) {
        return setErrorMessage('No changes made')
      }
      setState({
        type: 'reset',
        target: { value: formState },
      })
      setOldFormState(formState)
      await updateItem(formState)
    }
  }

  const handleReset = () => {
    if (featureStepName === 'SectionContent') {
      return setSectionState({
        type: 'reset',
        target: { value: oldSectionState },
      })
    }
    if (featureContext === 'OptionContent') {
      return setOptionState({
        type: 'reset',
        target: { value: oldOptionState },
      })
    }
    if (featureStepName === 'FeatureContent') {
      return setFeatureState({
        type: 'reset',
        target: { value: oldFeatureState },
      })
    }
    setFormState({
      type: 'reset',
      target: { value: oldFormState },
    })
  }

  const handleStepChange = (progressStepIndex: number) => {
    handleSave()
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
    stepName,
  }

  const featureProps = {
    featureStepName,
    setFeatureStepName,
    formState,
    featureState,
    setFeatureState,
    setOldFeatureState,
    setFeatureIndex,
    optionState,
    setOptionState,
    setOldOptionState,
    setOptionIndex,
    sectionState,
    setSectionState,
    oldSectionState,
    setOldSectionState,
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
      name: 'Ancestry',
      content: <FeatureForm {...commonProps} {...featureProps} />,
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

  return saving ? (
    <Spinner />
  ) : (
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
            ]?.content
          }
          <FormFooter
            handleBack={handleBack}
            forwardLabel={
              featureStepName === ''
                ? isLastStep
                  ? context.type === 'edit'
                    ? 'Update'
                    : 'Create'
                  : 'Next'
                : 'Finish'
            }
            handleReset={() => handleReset()}
            handleForward={() => {
              if (
                isLastStep &&
                context.type === 'edit' &&
                featureStepName === ''
              ) {
                handleUpdate()
              } else {
                handleForward()
              }
            }}
            backLabel={isFirstStep ? 'Cancel' : 'Back'}
            handleUpdate={() => handleUpdate()}
            isLastStep={isLastStep && featureStepName === ''}
            context={context.type}
          />
        </>
      )}
    </form>
  )
}

export default Form
