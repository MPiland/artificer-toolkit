import { Button, type ButtonProps } from '@mantine/core'
import { useFormContext } from '@/components/Form'

type SubscribeSubmitProps = {
  label: string
} & Omit<ButtonProps, 'loading' | 'disabled' | 'type'>

const SubscribeSubmit = ({ label, ...props }: SubscribeSubmitProps) => {
  const { Subscribe } = useFormContext()

  return (
    <Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
      {([canSubmit, isSubmitting]) => (
        <Button loading={isSubmitting} disabled={!canSubmit} type='submit' {...props}>
          {label}
        </Button>
      )}
    </Subscribe>
  )
}

export default SubscribeSubmit
