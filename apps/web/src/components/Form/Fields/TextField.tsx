import { TextInput, type TextInputProps } from '@mantine/core'
import { useFieldContext } from './FieldContext'
import { sprinkles } from '@css/sprinkles.css'

type TextFieldProps = {
  label?: string
  placeholder?: string
  onChange?: (value: string | number | null | undefined) => string | number | undefined
} & Omit<TextInputProps, 'label' | 'value' | 'error' | 'name' | 'onBlur'>

const TextField = ({ label, placeholder, ...props }: TextFieldProps) => {
  // The `Field` infers that it should have a `value` type of `string`
  const { state, name, handleChange, handleBlur } = useFieldContext<string | number>()

  return (
    <TextInput
      labelProps={{
        className: sprinkles({ mb: 'space-2' }),
      }}
      label={label}
      placeholder={placeholder || ''}
      name={name}
      value={state.value || ''}
      onBlur={handleBlur}
      onChange={(e) => {
        console.log(e.target.value)
        handleChange(e.target.value)
      }}
      error={!state.meta.isValid && state.meta.errors?.join(', ')}
      {...props}
    />
  )
}

export default TextField
