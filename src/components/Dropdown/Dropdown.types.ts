import type { ReactElement } from 'react'
import { DeepKeyOf, OnChange } from '@/types'

export type DropdownOption = {
  label: string | number | null | undefined
  value: string | number | null | undefined
  id: string
  [key: string]: any
  renderedLabel?: string | number | null | undefined | ReactElement
}

export interface DropdownProps<T> {
  label?: string | boolean
  required?: boolean
  value: string[] | string | null | undefined
  onChange: {
    updateField: OnChange<T>['updateField']
    removeField: OnChange<T>['removeField']
  }
  className?: string | number | symbol | any
  placeholder?: string
  options: DropdownOption[]
  multiSelect?: boolean
  errorMsg?: string
  id?: string
  all?: boolean
  height?: 'full' | 'auto' | 'default'
  border?: 'none' | 'default'
  name: DeepKeyOf<T>
  boundary?: 'app' | 'form'
  disableRemove?: boolean
}
