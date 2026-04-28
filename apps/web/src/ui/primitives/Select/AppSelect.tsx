import { Select } from '@mantine/core'
import type { AppSelectProps } from './Select.types'
import { toComboboxData } from './selectOptions'
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
  styles,
  ...props
}: AppSelectProps) {
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
    <Select
      data={toComboboxData(data)}
      value={value ?? null}
      onChange={onChange}
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
