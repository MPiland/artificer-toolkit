import { Checkbox, type CheckboxProps } from '@mantine/core'
import { useFieldContext } from '@/components/Form'

type CheckboxFieldProps = {
  label: string
} & Omit<CheckboxProps, 'label' | 'value' | 'onChange' | 'name'>

const CheckboxField = ({ label, ...props }: CheckboxFieldProps) => {
  // The `Field` infers that it should have a `value` type of `string`
  const { state, name, handleChange } = useFieldContext<boolean>()
  return (
    <Checkbox
      label={label}
      name={name}
      checked={state.value}
      onChange={(e) => handleChange(e.target.checked)}
      {...props}
    />
  )
}

export default CheckboxField
