import { form_wrapper } from './Form.css'
import { useEffect, useState, useRef, useContext } from 'react'
import Spinner from '../Spinner/Spinner'
import { useLocation } from 'react-router-dom'
import { useEventListener } from 'usehooks-ts'
import { BaseQueryFn, FetchArgs, FetchBaseQueryError, TypedUseMutation } from '@reduxjs/toolkit/query/react'
import FormFooter from './FormFooter'
import FormHeader from './FormHeader'
import ProgressBar from './ProgressBar'
import { FormStepsContext } from './FormStepsContext'
import CharacterHeader from './Character/CharacterHeader'

interface FormProps {
  useAddNewItem: TypedUseMutation<any, any, BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>>
  useUpdateItem: TypedUseMutation<any, any, BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>>
}

const Form = ({ useAddNewItem, useUpdateItem }: FormProps) => {
  const location = useLocation()

  const formItem = location.state?.item
  const formType = location.state?.formType
  const formTitle = location.state?.form

  const {
    formState,
    setFormState,
    setOldFormState,
    saving,
    stepIndex,
    context,
    setContext,
    isFirstStep,
    setIsFirstStep,
    isLastStep,
    setIsLastStep,
    successMessage,
    setSuccessMessage,
    errorMessage,
    setErrorMessage,
    validForm,
    setValidForm,
    formSteps,
    filteredSteps,
  } = useContext(FormStepsContext)

  const [isLoading, setIsLoading] = useState<boolean>((formType === 'new' && formItem?._id) ?? false)

  const documentRef = useRef(document)

  useEffect(() => {
    // Set form context
    if ((formTitle || formType) && (context.title == null || context.type == null)) {
      setContext({ title: formTitle, type: formType })
    }

    // Set formState if an item is being edited
    if ((formItem?._id && !formState._id) || (formItem && !formState && formType === 'edit')) {
      setFormState({ type: 'reset', target: { value: formItem } })
    }

    // Reset a copy name
    if (formItem && formItem?.value !== '' && isLoading && formType === 'new') {
      setFormState({ target: { name: 'value', value: '' } })
      const oldFormItem = JSON.parse(JSON.stringify(formItem))
      oldFormItem.value = ''
      setOldFormState(oldFormItem)
    }
    setIsLoading(false)
  }, [
    formTitle,
    formItem,
    formType,
    setContext,
    formState,
    setFormState,
    isLoading,
    setOldFormState,
    context.title,
    context.type,
  ])

  // Set valid check default
  useEffect(() => {
    filteredSteps.forEach((step: string) => {
      if (validForm?.[step] == null) {
        setValidForm({ ...validForm, [step]: true })
      }
    })
  }, [filteredSteps, setValidForm, validForm])

  // Last/First Step
  useEffect(() => {
    if (stepIndex === 0) {
      if (!isFirstStep) {
        setIsFirstStep(true)
      }
      if (isLastStep) {
        setIsLastStep(false)
      }
    } else if (stepIndex === filteredSteps?.length - 1) {
      if (!isLastStep) {
        setIsLastStep(true)
      }
      if (isFirstStep) {
        setIsFirstStep(false)
      }
    } else {
      if (isLastStep) {
        setIsLastStep(false)
      }
      if (isFirstStep) {
        setIsFirstStep(false)
      }
    }
  }, [stepIndex, filteredSteps, formState, setIsFirstStep, setIsLastStep, isFirstStep, isLastStep])

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

  console.log({ formState })

  return isLoading || !formState || saving ? (
    <Spinner />
  ) : (
    <form className={form_wrapper}>
      {filteredSteps.length > 1 && <ProgressBar />}
      <FormHeader />
      {context.title === 'character' && <CharacterHeader />}
      {formSteps.find((step) => step.name === filteredSteps[stepIndex])?.content}
      <FormFooter useAddNewItem={useAddNewItem} useUpdateItem={useUpdateItem} />
    </form>
  )
}

export default Form
