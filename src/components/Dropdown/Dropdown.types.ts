import type {ReactElement } from 'react'

export type DropdownOption = {
  label: string | number | null | undefined
  id: string
  [key: string]: any
  renderedLabel?: string | number | null | undefined | ReactElement
}

export type DropdownCommonProps = {
  placeholder?: string
  label?: string
  required?: boolean
}

export type DropdownProps = {
  value: string[] | string | null | undefined
  onChange: (value: string | string[] | undefined | null) => void
  className?: string | number | symbol | any
  options: DropdownOption[]
  multiselect?: boolean
  errorMsg?: string
  id?: string
  all?: boolean
  disableRemove?: boolean
  name: string
} & DropdownCommonProps
