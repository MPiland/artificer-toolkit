import { Alert, type AlertProps } from '@mantine/core'
import { Info } from 'lucide-react'
import { useFormContext } from '@/components/Form'

type SubscribeAlertProps = AlertProps

const SubscribeAlert = ({ ...props }: SubscribeAlertProps) => {
  const { Subscribe } = useFormContext()

  return (
    <Subscribe selector={(state) => [state.errorMap]}>
      {([errorMap]) => {
        let errorMessage = ''
        if (errorMap?.onSubmit?.form?.message) {
          errorMessage = errorMap.onSubmit.form.message
        } else if (errorMap?.onSubmit?.message) {
          errorMessage = errorMap.onSubmit.message
        }
        return (
          errorMessage && (
            <Alert {...props} icon={<Info />}>
              {errorMessage}
            </Alert>
          )
        )
      }}
    </Subscribe>
  )
}

export default SubscribeAlert
