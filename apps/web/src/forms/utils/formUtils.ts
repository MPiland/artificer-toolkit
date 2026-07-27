export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
  group?: string
}

export function getFieldError(field: {
  state: {
    meta: {
      errors?: readonly unknown[]
    }
  }
}) {
  const errors = field.state.meta.errors
  if (!errors?.length) return undefined

  return errors.map((error) => (typeof error === 'string' ? error : String(error))).join(', ')
}

export function toInputValue(value: string | null | undefined) {
  return value ?? ''
}

export function uniqueSelectOptions(options: readonly SelectOption[]): SelectOption[] {
  const seen = new Set<string>()
  const uniqueOptions: SelectOption[] = []

  for (const option of options) {
    if (seen.has(option.value)) continue
    seen.add(option.value)
    uniqueOptions.push(option)
  }

  return uniqueOptions
}
