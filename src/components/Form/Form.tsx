import { form_content, form_wrapper } from './Form.css'
import { useRef } from 'react'
import Spinner from '../Spinner/Spinner'
import { useEventListener } from 'usehooks-ts'
import Footer from './Footer'
import Header from './ProgressBar/Header'
import CharacterHeader from './Character/CharacterHeader'
import ScrollArea from '../ScrollArea/ScrollArea'
import { useForm } from '../../hooks/UseForm'
import { Outlet } from 'react-router-dom'
import FeatureProvider from './Features/FeatureProvider'
import { UseMutationResult } from '@tanstack/react-query'
import { CustomError } from '../../app/api/api'

interface FormProps {
  useAddNewItem: () => UseMutationResult<any, CustomError, string, unknown>
  useUpdateItem: () => UseMutationResult<any, CustomError, string, unknown>
}

const Form = ({ useAddNewItem, useUpdateItem }: FormProps) => {
  const {
    formState,
    saving,
    stepIndex,
    context,
    successMessage,
    setSuccessMessage,
    errorMessage,
    setErrorMessage,
    formSteps,
    steps,
  } = useForm()

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

  console.log({ formState })

  return !formState || saving ? (
    <Spinner />
  ) : (
    <FeatureProvider>
      <form className={form_wrapper} id='form_wrapper'>
        <Header />
        {context.title === 'characters' && <CharacterHeader />}
        <ScrollArea scrollDirection='vertical' className={form_content} wrapperId={'form_content'}>
          {formSteps[`${steps[stepIndex]?.id}`]}
        </ScrollArea>
        <Footer useAddNewItem={useAddNewItem} useUpdateItem={useUpdateItem} />
      </form>
      <Outlet />
    </FeatureProvider>
  )
}

export default Form
