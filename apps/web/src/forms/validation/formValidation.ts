export type FieldMetaSnapshot = {
  errors?: readonly unknown[]
  isDirty?: boolean
  isValid?: boolean
}

export type StepStatus = 'valid' | 'dirty' | 'error'

export type StepFieldMap<TStep extends string> = Record<TStep, readonly string[]>

export type FieldValidator = ({ value }: { value: unknown }) => string | undefined

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

export function minimumNumber(label: string, minimum: number): FieldValidator {
  return ({ value }) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return `${label} must be a number.`
    return value >= minimum ? undefined : `${label} must be at least ${minimum}.`
  }
}

export function integerMinimum(label: string, minimum: number): FieldValidator {
  return ({ value }) => {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isInteger(value)) {
      return `${label} must be a whole number.`
    }

    return value >= minimum ? undefined : `${label} must be at least ${minimum}.`
  }
}

export function dieConfig(label: string): FieldValidator {
  return ({ value }) => {
    if (typeof value !== 'string' || value.trim().length === 0) return undefined
    return /^\d+d\d+([+-]\d+)?$/i.test(value.trim())
      ? undefined
      : `${label} must be a valid die configuration, like 2d6.`
  }
}

export function rollConfig(label: string): FieldValidator {
  return ({ value }) => {
    if (typeof value !== 'string' || value.trim().length === 0) return undefined
    return /^\d+d\d+([dkhlr]\d+)*([+-]\d+)?$/i.test(value.trim())
      ? undefined
      : `${label} must be a valid roll configuration.`
  }
}

export function validatorsFor(validator: FieldValidator) {
  return {
    onBlur: validator,
    onSubmit: validator
  }
}

export function getStepStatuses<TStep extends string>({
  fieldMeta,
  stepFields
}: {
  fieldMeta: Partial<Record<string, FieldMetaSnapshot>>
  stepFields: StepFieldMap<TStep>
}): Partial<Record<TStep, StepStatus>> {
  const statuses: Partial<Record<TStep, StepStatus>> = {}

  for (const [stepId, ownedFields] of typedEntries(stepFields)) {
    const ownedMeta = Object.entries(fieldMeta).filter(([path]) =>
      ownedFields.some((ownedPath) => isOwnedFieldPath(path, ownedPath))
    )
    const hasErrors = ownedMeta.some(([, meta]) => (meta?.errors?.length ?? 0) > 0)
    const hasDirtyFields = ownedMeta.some(([, meta]) => meta?.isDirty === true)

    if (hasErrors) {
      statuses[stepId] = 'error'
    } else if (hasDirtyFields) {
      statuses[stepId] = 'dirty'
    } else {
      statuses[stepId] = 'valid'
    }
  }

  return statuses
}

export function getFirstErroredStep<TStep extends string>(
  statuses: Partial<Record<TStep, StepStatus>>,
  steps: readonly { id: TStep }[]
): TStep | null {
  return steps.find((step) => statuses[step.id] === 'error')?.id ?? null
}

function isOwnedFieldPath(path: string, ownedPath: string): boolean {
  return path === ownedPath || path.startsWith(`${ownedPath}.`) || path.startsWith(`${ownedPath}[`)
}

function typedEntries<TStep extends string>(
  value: StepFieldMap<TStep>
): Array<[TStep, readonly string[]]> {
  return Object.entries(value) as Array<[TStep, readonly string[]]>
}
