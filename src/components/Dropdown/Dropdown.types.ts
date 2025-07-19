import type { ReactElement, FocusEvent } from 'react'

type NotValueKey = { [K in string as K extends 'value' ? never : K]?: unknown }

export type DropdownOption = {
  label: string | number | null | undefined
  id: string
  renderedLabel?: string | number | null | undefined | ReactElement
} & NotValueKey

export type DropdownCommonProps = {
  placeholder?: string
  label?: string
  required?: boolean
  onBlur?: (arg: FocusEvent<HTMLInputElement>) => void
}

export type DropdownProps = {
  value: string[] | string | null | undefined
  onChange: (value: string | string[] | undefined | null) => void
  className?: string | number | symbol | unknown
  options: DropdownOption[]
  multiselect?: boolean
  error?: string
  id?: string
  all?: boolean
  disableRemove?: boolean
  name: string
  onBlur?: (arg: FocusEvent<HTMLInputElement>) => void
} & DropdownCommonProps
