import { z } from 'zod/v4'
import { form_content, form_wrapper } from './Form.css'
import { Suspense } from 'react'
import { useEventListener, mergeRefs } from '@mantine/hooks'
import Footer from './Footer'
import Header from './Header/Header'
import { UseMutationResult } from '@tanstack/react-query'
import type { FormDataType, SourceDataType } from '@/types'
import { use } from 'react'
import { FormContext } from './FormContext'
import Loading from '@/components/Loading'
import FeatureProvider from './Features/FeatureProvider'
import { ScrollArea } from '@mantine/core'
import { useAppForm } from './utils/factory'
import { discriminatedDomainInputSchema } from '@/schemas'

interface FormProps<T extends SourceDataType, V extends FormDataType> {
  useAddNewItemMutation: () => UseMutationResult<T, Error, V, unknown>
  useUpdateItemMutation: () => UseMutationResult<T, Error, V, unknown>
}

const Form = <T extends SourceDataType, V extends FormDataType>({
  useAddNewItemMutation,
  useUpdateItemMutation,
}: FormProps<T, V>) => {
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

  const defaultValues: z.input<typeof discriminatedDomainInputSchema> = discriminatedDomainInputSchema.parse(
    formStore.data
  )

  const form = useAppForm({
    defaultValues: defaultValues,
  })

  const { handleSubmit } = form

  const StepComponent = formSteps[`${steps[stepIndex]?.id}`]

  return (
    <Suspense fallback={<Loading />}>
      <FeatureProvider>
        <form
          className={form_wrapper}
          id='form-wrapper'
          ref={documentRef}
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleSubmit()
          }}
        >
          <Header />
          <ScrollArea className={form_content}>
            <StepComponent form={form} />
          </ScrollArea>
          <Footer
            useAddNewItemMutation={useAddNewItemMutation}
            useUpdateItemMutation={useUpdateItemMutation}
            form={form}
          />
        </form>
        {saving && <Loading />}
      </FeatureProvider>
    </Suspense>
  )
}

export default Form
