import { MultiSelect, Pill } from '@mantine/core'
import type { AppMultiSelectProps } from './Select.types'
import {
  addAllOption,
  DEFAULT_ALL_OPTION_LABEL,
  DEFAULT_ALL_OPTION_VALUE,
  getClearButtonAriaLabel,
  resolveMultiSelectValue,
  toComboboxData
} from './selectOptions'
import * as selectStyles from './Select.css.ts'

const renderAppMultiSelectPill: NonNullable<AppMultiSelectProps['renderPill']> = ({
  option,
  value,
  onRemove,
  disabled
}) => {
  const label = option?.label ?? String(value ?? '')

  return (
    <Pill
      classNames={{
        root: selectStyles.pill,
        label: selectStyles.pillLabel,
        remove: selectStyles.pillRemove
      }}
      disabled={disabled}
      onRemove={onRemove}
      removeButtonProps={{ 'aria-label': label ? `Remove ${label}` : 'Remove selected option' }}
      withRemoveButton={Boolean(onRemove) && !disabled}
    >
      {label || 'Unknown option'}
    </Pill>
  )
}

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
  clearButtonProps,
  renderPill,
  ...props
}: AppMultiSelectProps) {
  const resolvedValue = value ?? []
  const resolvedData = includeAllOption
    ? addAllOption(data, { value: allOptionValue, label: allOptionLabel })
    : toComboboxData(data)

  return (
    <MultiSelect
      data={resolvedData}
      value={resolvedValue}
      onChange={(nextValue) => {
        onChange(
          includeAllOption
            ? resolveMultiSelectValue({
                currentValue: resolvedValue,
                nextValue,
                allOptionValue
              })
            : nextValue
        )
      }}
      disabled={disabled}
      clearable={clearable}
      clearButtonProps={{
        'aria-label': getClearButtonAriaLabel(props.label, 'Clear selected options'),
        ...clearButtonProps
      }}
      searchable={searchable}
      checkIconPosition='right'
      comboboxProps={{
        withinPortal: true,
        ...comboboxProps
      }}
      classNames={
        typeof classNames === 'function'
          ? (theme, multiSelectProps, context) => ({
              root: selectStyles.root,
              label: selectStyles.label,
              description: selectStyles.description,
              required: selectStyles.required,
              input: `${selectStyles.input} ${selectStyles.multiSelectInput}`,
              dropdown: selectStyles.dropdown,
              option: selectStyles.option,
              pillsList: selectStyles.pillsList,
              inputField: selectStyles.inputField,
              ...classNames(theme, multiSelectProps, context)
            })
          : {
              root: selectStyles.root,
              label: selectStyles.label,
              description: selectStyles.description,
              required: selectStyles.required,
              input: `${selectStyles.input} ${selectStyles.multiSelectInput}`,
              dropdown: selectStyles.dropdown,
              option: selectStyles.option,
              pillsList: selectStyles.pillsList,
              inputField: selectStyles.inputField,
              ...classNames
            }
      }
      renderPill={renderPill ?? renderAppMultiSelectPill}
      {...props}
    />
  )
}
