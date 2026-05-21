import type { SelectProps, MultiSelectProps } from '@mantine/core'

export type AppSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

export type AppSelectOptionGroup = {
  group: string
  items: AppSelectOption[]
}

export type AppSelectData = AppSelectOption[] | AppSelectOptionGroup[]

export type AppSelectProps = Omit<
  SelectProps,
  'data' | 'styles' | 'value' | 'onChange'
> & {
  data: AppSelectData
  value: string | null | undefined
  onChange: (value: string | null) => void
}

export type AppMultiSelectProps = Omit<
  MultiSelectProps,
  'data' | 'styles' | 'value' | 'onChange'
> & {
  data: AppSelectData
  value: string[] | null | undefined
  onChange: (value: string[]) => void
  includeAllOption?: boolean
  allOptionLabel?: string
  allOptionValue?: string
}
