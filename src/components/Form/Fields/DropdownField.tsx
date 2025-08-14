import type { DropdownProps, DropdownOption } from '~/components/Dropdown'
import Dropdown from '~/components/Dropdown'
import { useFieldContext } from './FieldContext'

type DropdownFieldProps = {
  label?: string
  placeholder?: string
  options: DropdownOption[]
  exist?: string
  multiselect?: boolean
} & Omit<DropdownProps, 'label' | 'value' | 'onChange' | 'error' | 'name' | 'onBlur' | 'multiselect'>

const DropdownField = ({ label, placeholder, options, exist, multiselect, ...props }: DropdownFieldProps) => {
  // Use union type to handle both single and multi-select cases
  const { state, name, handleBlur, handleChange, setValue } = useFieldContext<string | string[] | undefined | null>()

  if (exist != null) {
    if (multiselect === true) {
      setValue([exist])
    } else {
      setValue(exist)
    }
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
      error={state.meta.errors?.join(', ')}
      multiselect={multiselect}
      {...props}
    />
  )
}

export default DropdownField
