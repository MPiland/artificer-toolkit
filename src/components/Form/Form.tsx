import { Suspense, type ReactNode } from 'react'
import { Footer, Header, content, form, CharacterHeader } from '@/components/Form'
import { UseMutationResult } from '@tanstack/react-query'
import type { FormDataType, SourceDataType } from '@/types'
import { Modal, ScrollArea } from '@mantine/core'
import { useFormStore } from '@/store'
import Loading from '@/components/Loading'
import { useMediaQuery } from '@mantine/hooks'
import { sprinkles } from '@/css/sprinkles.css'

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
  const __kind = useFormStore((state) => state.current?.__kind)
  const sm = useMediaQuery('(max-width: 768px)')

  return (
    <form
      className={form}
      id='form-wrapper'
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <Header />
      {__kind === 'CharacterInput' && <CharacterHeader setFieldValueFn={() => undefined} />}
      <Suspense
        fallback={
          <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
            <Loading />
          </Modal>
        }
      >
        <ScrollArea
          classNames={{
            content: content,
          }}
          className={sprinkles({ flex: '1' })}
          type={sm ? 'auto' : 'hover'}
        >
          {children}
        </ScrollArea>
      </Suspense>
      <Footer useAddNewItemMutation={useAddNewItemMutation} useUpdateItemMutation={useUpdateItemMutation} />
    </form>
  )
}

export default Form
