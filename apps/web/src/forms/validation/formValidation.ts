type FieldValidator = ({ value }: { value: unknown }) => string | undefined

export function requiredString(label: string): FieldValidator {
  return ({ value }) => {
    if (typeof value !== 'string') return `${label} is required.`
    return value.trim().length > 0 ? undefined : `${label} is required.`
  }
}

export function requiredSelect(label: string): FieldValidator {
  return ({ value }) => {
    if (typeof value !== 'string') return `${label} is required.`
    return value.trim().length > 0 ? undefined : `${label} is required.`
  }
}

export function requiredArray(label: string): FieldValidator {
  return ({ value }) => {
    return Array.isArray(value) && value.length > 0 ? undefined : `${label} is required.`
  }
}

export function requiredNumber(label: string): FieldValidator {
  return ({ value }) => {
    return typeof value === 'number' && !Number.isNaN(value) ? undefined : `${label} is required.`
  }
}

export function requiredBoolean(label: string): FieldValidator {
  return ({ value }) => {
    return typeof value === 'boolean' ? undefined : `${label} is required.`
  }
}

export function validatorsFor(validator: FieldValidator) {
  return {
    onBlur: validator,
    onSubmit: validator
  }
}
