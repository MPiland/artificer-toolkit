import type { ComboboxData, ComboboxItem } from '@mantine/core'
import type { AppSelectData, AppSelectOption, AppSelectOptionGroup } from './Select.types'

export const DEFAULT_ALL_OPTION_VALUE = 'all'
export const DEFAULT_ALL_OPTION_LABEL = 'All'

export function toComboboxData(data: AppSelectData): ComboboxData {
  if (isGroupedData(data)) {
    return data.map((group) => ({
      group: group.group,
      items: normalizeOptions(group.items)
    }))
  }

  return normalizeOptions(data)
}

export function addAllOption(
  data: AppSelectData,
  allOption: AppSelectOption = {
    value: DEFAULT_ALL_OPTION_VALUE,
    label: DEFAULT_ALL_OPTION_LABEL
  }
): ComboboxData {
  const normalized = toComboboxData(data)

  return [allOption, ...normalized]
}

export function resolveMultiSelectValue({
  currentValue,
  nextValue,
  allOptionValue = DEFAULT_ALL_OPTION_VALUE
}: {
  currentValue: string[]
  nextValue: string[]
  allOptionValue?: string
}) {
  const hadAll = currentValue.includes(allOptionValue)
  const hasAll = nextValue.includes(allOptionValue)

  if (hasAll && !hadAll) return [allOptionValue]
  if (hasAll && nextValue.length > 1) {
    return nextValue.filter((value) => value !== allOptionValue)
  }

  return nextValue
}

function normalizeOptions(options: AppSelectOption[]): ComboboxItem[] {
  return options
    .filter((option) => option.label.trim().length > 0)
    .map((option) => ({
      value: option.value,
      label: option.label,
      disabled: option.disabled
    }))
}

function isGroupedData(data: AppSelectData): data is AppSelectOptionGroup[] {
  return data.some((item) => 'group' in item)
}
