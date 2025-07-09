import { type PasswordInputProps, PasswordInput } from '@mantine/core'
import { useFieldContext } from '@/components/Form'

type PasswordFieldProps = {
  label: string
} & Omit<PasswordInputProps, 'label' | 'value' | 'onChange' | 'error' | 'name' | 'onBlur'>

const PasswordField = ({ label, ...props }: PasswordFieldProps) => {
  // The `Field` infers that it should have a `value` type of `string`
  const { state, name, handleChange, handleBlur } = useFieldContext<string>()
  return (
    <PasswordInput
      label={label}
      placeholder='Password...'
      name={name}
      value={state.value}
      onBlur={handleBlur}
      onChange={(e) => handleChange(e.target.value)}
      error={!state.meta.isValid && state.meta.errors.join(', ')}
      {...props}
    />
  )
}

export default PasswordField
