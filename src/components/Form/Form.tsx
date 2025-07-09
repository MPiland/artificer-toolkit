import { Suspense, type ReactNode } from 'react'
import { Footer, Header, form_content, form_wrapper, CharacterHeader } from '@/components/Form'
import { UseMutationResult } from '@tanstack/react-query'
import type { FormDataType, SourceDataType } from '@/types'
import Loading from '@/components/Loading'
import { ScrollArea } from '@mantine/core'
import { useFormStore } from '@/store'

interface FormProps<T extends SourceDataType, V extends FormDataType> {
  useAddNewItemMutation: () => UseMutationResult<T, Error, V, unknown>
  useUpdateItemMutation: () => UseMutationResult<T, Error, V, unknown>
  children: ReactNode
}

const Form = <T extends SourceDataType, V extends FormDataType>({
  useAddNewItemMutation,
  useUpdateItemMutation,
  children,
}: FormProps<T, V>) => {
  const formStore = useFormStore()
  return (
    <Suspense fallback={<Loading />}>
      <form
        className={form_wrapper}
        id='form-wrapper'
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <Header />
        {formStore.current?.__kind === 'CharacterInput' && <CharacterHeader setFieldValueFn={() => undefined} />}
        <ScrollArea className={form_content}>{children}</ScrollArea>
        <Footer useAddNewItemMutation={useAddNewItemMutation} useUpdateItemMutation={useUpdateItemMutation} />
      </form>
    </Suspense>
  )
}

export default Form
