import type { DropdownProps, DropdownOption } from '@/components/Form/Dropdown'
import Dropdown from '@/components/Form/Dropdown'
import { useFieldContext } from '@/components/Form'

type DropdownFieldProps = {
  label?: string
  placeholder?: string
  options: DropdownOption[]
  exist?: string
} & Omit<DropdownProps, 'label' | 'value' | 'onChange' | 'error' | 'name' | 'onBlur'>

const DropdownField = ({ label, placeholder, options, exist, ...props }: DropdownFieldProps) => {
  // The `Field` infers that it should have a `value` type of `string`
  const { state, name, handleBlur, handleChange, setValue } = useFieldContext<string | string[] | undefined | null>()

  if (exist != null) {
    setValue(exist)
  }

  return (
    <Dropdown
      label={label}
      name={name}
      value={state.value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      options={options}
      error={state.meta.errors.join(', ')}
      {...props}
    />
  )
}

export default DropdownField
