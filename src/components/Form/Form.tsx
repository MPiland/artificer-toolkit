import { form_content, form_wrapper } from './Form.css'
import { useRef } from 'react'
import { useEventListener } from 'usehooks-ts'
import Footer from './Footer'
import Header from './ProgressBar/Header'
import CharacterHeader from './Character/CharacterHeader'
import ScrollArea from '../ScrollArea/ScrollArea'
import { Outlet } from 'react-router-dom'
import { UseMutationResult } from '@tanstack/react-query'
import { FormDataType, FormInputType } from '../../types/form'
import { use } from 'react'
import FormContext from './FormContext'
import FeatureContext, { FeatureOptions } from './Features/FeatureContext'
import Loading from '../Loading/Loading'

interface FormProps<T extends FormDataType> {
  useAddNewItemMutation: () => UseMutationResult<T, Error, FormInputType, unknown>
  useUpdateItemMutation: () => UseMutationResult<T, Error, FormInputType, unknown>
}

const Form = <T extends FormDataType>({ useAddNewItemMutation, useUpdateItemMutation }: FormProps<T>) => {
  const {
    formData,
    stepIndex,
    context,
    successMessage,
    setSuccessMessage,
    errorMessage,
    setErrorMessage,
    formSteps,
    steps,
    saving,
  } = use(FormContext)

  const documentRef = useRef(document)

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

  console.log({ formData })

  return saving ? (
    <Loading />
  ) : (
    <FeatureContext value={FeatureOptions()}>
      <form className={form_wrapper} id='form_wrapper'>
        <Header />
        {context.title === 'characters' && <CharacterHeader />}
        <ScrollArea scrollDirection='vertical' className={form_content} wrapperId={'form_content'}>
          {formSteps[`${steps[stepIndex]?.id}`]}
        </ScrollArea>
        <Footer useAddNewItemMutation={useAddNewItemMutation} useUpdateItemMutation={useUpdateItemMutation} />
      </form>
      <Outlet />
    </FeatureContext>
  )
}

export default Form
