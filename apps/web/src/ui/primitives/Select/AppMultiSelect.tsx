import { MultiSelect } from '@mantine/core'
import type { AppMultiSelectProps } from './Select.types'
import { addAllOption, DEFAULT_ALL_OPTION_LABEL, DEFAULT_ALL_OPTION_VALUE, resolveMultiSelectValue, toComboboxData } from './selectOptions'
import * as selectStyles from './Select.css.ts'

export function AppMultiSelect({
  data,
  value,
  onChange,
  clearable = false,
  searchable = true,
  includeAllOption = false,
  allOptionLabel = DEFAULT_ALL_OPTION_LABEL,
  allOptionValue = DEFAULT_ALL_OPTION_VALUE,
  disabled,
  comboboxProps,
  classNames,
  styles,
  ...props
}: AppMultiSelectProps) {
  const resolvedValue = value ?? []
  const resolvedData = includeAllOption
    ? addAllOption(data, { value: allOptionValue, label: allOptionLabel })
    : toComboboxData(data)
  const inputVisualStyles = disabled
    ? {
        backgroundColor: 'var(--at-color-input-background-disabled)',
        borderColor: 'var(--at-color-input-border-disabled)',
        color: 'var(--at-color-text-muted)'
      }
    : {
        backgroundColor: 'var(--at-color-input-background-default)',
        borderColor: 'var(--at-color-input-border-default)',
        color: 'var(--at-color-text-primary)'
      }

  return (
    <MultiSelect
      data={resolvedData}
      value={resolvedValue}
      onChange={(nextValue) => {
        onChange(includeAllOption
          ? resolveMultiSelectValue({ currentValue: resolvedValue, nextValue, allOptionValue })
          : nextValue)
      }}
      disabled={disabled}
      clearable={clearable}
      searchable={searchable}
      checkIconPosition='right'
      comboboxProps={{
        shadow: 'md',
        withinPortal: true,
        ...comboboxProps
      }}
      classNames={{
        root: selectStyles.root,
        label: selectStyles.label,
        description: selectStyles.description,
        input: selectStyles.input,
        dropdown: selectStyles.dropdown,
        option: selectStyles.option,
        pill: selectStyles.pill,
        pillsList: selectStyles.pillsList,
        inputField: selectStyles.inputField,
        ...classNames
      }}
      styles={{
        input: inputVisualStyles,
        ...styles
      }}
      {...props}
    />
  )
}
