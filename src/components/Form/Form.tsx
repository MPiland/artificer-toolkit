import { form_content, form_wrapper } from './Form.css'
import { Suspense } from 'react'
import { useEventListener, mergeRefs } from '@mantine/hooks'
import Footer from './Footer'
import Header from './Header/Header'
import { Outlet } from '@tanstack/react-router'
import { UseMutationResult } from '@tanstack/react-query'
import { FormDataType } from '@/types'
import { use } from 'react'
import { FormContext } from './FormContext'
import Loading from '@/components/Loading'
import FeatureProvider from './Features/FeatureProvider'
import { ScrollArea } from '@mantine/core'

interface FormProps<T extends FormDataType> {
  useAddNewItemMutation: () => UseMutationResult<T, Error, T, unknown>
  useUpdateItemMutation: () => UseMutationResult<T, Error, T, unknown>
}

const Form = <T extends FormDataType>({ useAddNewItemMutation, useUpdateItemMutation }: FormProps<T>) => {
  const { stepIndex, successMessage, errorMessage, formSteps, steps, saving, formStore } = use(FormContext)

  const keypressRef = useEventListener('keypress', () => {
    if (successMessage !== null) {
      formStore.setSuccessMessage(null)
    }
    if (errorMessage) {
      formStore.setErrorMessage(null)
    }
  })
  const mouseUpRef = useEventListener('mouseup', () => {
    if (successMessage !== null) {
      formStore.setSuccessMessage(null)
    }
    if (errorMessage) {
      formStore.setErrorMessage(null)
    }
  })

  const documentRef = mergeRefs(keypressRef, mouseUpRef)

  console.log({ data: formStore.data })

  return (
    <Suspense fallback={<Loading />}>
      <FeatureProvider>
        <form className={form_wrapper} id='form-wrapper' ref={documentRef}>
          <Header />
          <ScrollArea className={form_content}>{formSteps[`${steps[stepIndex]?.id}`]}</ScrollArea>
          <Footer useAddNewItemMutation={useAddNewItemMutation} useUpdateItemMutation={useUpdateItemMutation} />
        </form>
        <Outlet />
        {saving && <Loading />}
      </FeatureProvider>
    </Suspense>
  )
}

export default Form
