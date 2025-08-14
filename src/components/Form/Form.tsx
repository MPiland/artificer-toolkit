import { Suspense, type ReactNode } from 'react'
import { Footer, Header, content, form, CharacterHeader } from '~/components/Form'
import { Modal, ScrollArea } from '@mantine/core'
import { useFormStore } from '~/store'
import Loading from '~/components/Loading'
import { useMediaQuery } from '@mantine/hooks'
import { sprinkles } from '~/css/sprinkles.css'

const Form = ({ children }: { children: ReactNode }) => {
  const __kind = useFormStore((state) => state.current?.__kind)
  const sm = useMediaQuery('(max-width: 768px)')

  return (
    <>
      <Header />
      {__kind === 'CharacterInput' && <CharacterHeader setFieldValueFn={() => undefined} />}
      <ScrollArea
        classNames={{
          content: content,
        }}
        className={sprinkles({ flex: '1' })}
        type={sm ? 'auto' : 'hover'}
      >
        <Suspense
          fallback={
            <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
              <Loading />
            </Modal>
          }
        >
          <form
            className={form}
            id='form-wrapper'
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            {children}
          </form>
        </Suspense>
      </ScrollArea>
      <Footer />
    </>
  )
}

export default Form
