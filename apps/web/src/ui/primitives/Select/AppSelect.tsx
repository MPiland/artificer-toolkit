import { Select } from '@mantine/core'
import type { AppSelectProps } from './Select.types'
import { getClearButtonAriaLabel, toComboboxData } from './selectOptions'
import * as selectStyles from './Select.css.ts'

export function AppSelect({
  data,
  value,
  onChange,
  clearable = false,
  searchable = true,
  disabled,
  comboboxProps,
  classNames,
  clearButtonProps,
  ...props
}: AppSelectProps) {
  return (
    <Select
      data={toComboboxData(data)}
      value={value ?? null}
      onChange={onChange}
      disabled={disabled}
      clearable={clearable}
      clearButtonProps={{
        'aria-label': getClearButtonAriaLabel(props.label, 'Clear selected option'),
        ...clearButtonProps
      }}
      searchable={searchable}
      checkIconPosition='right'
      comboboxProps={{
        withinPortal: true,
        ...comboboxProps
      }}
      classNames={typeof classNames === 'function'
        ? (theme, selectProps, context) => ({
            root: selectStyles.root,
            label: selectStyles.label,
            description: selectStyles.description,
            required: selectStyles.required,
            input: selectStyles.input,
            dropdown: selectStyles.dropdown,
            option: selectStyles.option,
            ...classNames(theme, selectProps, context)
          })
        : {
            root: selectStyles.root,
            label: selectStyles.label,
            description: selectStyles.description,
            required: selectStyles.required,
            input: selectStyles.input,
            dropdown: selectStyles.dropdown,
            option: selectStyles.option,
            ...classNames
          }}
      {...props}
    />
  )
}
