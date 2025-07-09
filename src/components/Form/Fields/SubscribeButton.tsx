import { Button, type ButtonProps } from '@mantine/core'
import { useFormContext } from '@/components/Form'

type SubscribeButtonProps = {
  label: string
} & Omit<ButtonProps, 'loading' | 'disabled'>

const SubscribeButton = ({ label, ...props }: SubscribeButtonProps) => {
  const { Subscribe } = useFormContext()

  return (
    <Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
      {([canSubmit, isSubmitting]) => (
        <Button loading={isSubmitting} disabled={!canSubmit} {...props}>
          {label}
        </Button>
      )}
    </Subscribe>
  )
}

export default SubscribeButton
