import type { AnyFieldApi } from '@tanstack/react-form'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
  group?: string
}

export function getFieldError(field: AnyFieldApi) {
  const errors = field.state.meta.errors
  if (!errors?.length) return undefined

  return errors
    .map((error) => typeof error === 'string' ? error : String(error))
    .join(', ')
}

export function toInputValue(value: unknown) {
  return value === undefined || value === null ? '' : String(value)
}
