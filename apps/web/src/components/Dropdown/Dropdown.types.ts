import type { FocusEvent, ReactElement, ReactNode } from 'react'

type NotValueKey = { [K in string as K extends 'value' ? never : K]?: unknown }

export type DropdownOption = {
  label: string | number | null | undefined
  id: string
  renderedLabel?: string | number | null | undefined | ReactElement
} & NotValueKey

export type DropdownOptionGroup = {
  label: string
  options: DropdownOption[]
}

export type DropdownCommonProps = {
  placeholder?: string
  label?: string
  description?: ReactNode
  required?: boolean
  disabled?: boolean
  onBlur?: (arg: FocusEvent<HTMLInputElement>) => void
}

// Base props without value, onChange, and multiselect
type DropdownBaseProps = {
  className?: string
  options?: DropdownOption[]
  optionGroups?: DropdownOptionGroup[]
  error?: string
  id?: string
  /** @deprecated Prefer includeAllOption. Kept temporarily for legacy callers. */
  all?: boolean
  includeAllOption?: boolean
  disableRemove?: boolean
  name?: string
  onBlur?: (arg: FocusEvent<HTMLInputElement>) => void
} & DropdownCommonProps

export interface DropdownProps extends DropdownBaseProps {
  multiselect?: boolean
  value: string | string[] | null | undefined
  onChange: (value: string | string[] | undefined | null) => void
}
