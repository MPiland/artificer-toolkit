import { z, ZodNumber, ZodString } from 'zod/v4'
import { DIE_REGEX, ROLL_CONFIG_REGEX } from '@components/Form'
import { useOptimizedSelector, useTypedFormStore } from '@store'

export const useFieldUpdates = () => {
  const store = useTypedFormStore()
  const { updateField } = useOptimizedSelector(store, (state) => ({
    updateField: state.updateField,
  }))

  const handleBlur = ({
    target: { name, value },
  }: {
    target: { name: string; value: string | string[] | number | boolean | object | null | undefined }
  }) => {
    const pathName = name
    updateField({ path: pathName, value })
  }

  const fieldListeners = {
    // onBlurDebounceMs: 300,
    onBlur: ({
      value,
      name,
    }: {
      value: string | string[] | number | object | boolean | null | undefined
      name: string
    }) => {
      handleBlur({
        target: { name: name, value },
      })
    },
  }

  type FieldValidatorOnChange =
    | { type: 'number'; min: number; name: string }
    | { type: 'integer'; min: number; name: string }
    | { type: 'die'; name: string }
    | { type: 'roll'; name: string }
    | { type: 'string'; name: string }

  type ZodSchemaFor<T extends FieldValidatorOnChange> =
    T extends { type: 'number' } ? ZodNumber
    : T extends { type: 'integer' } ? ZodNumber
    : T extends { type: 'die' } ? ZodString
    : T extends { type: 'roll' } ? ZodString
    : T extends { type: 'string' } ? ZodString
    : undefined

  const fieldValidators = <T extends FieldValidatorOnChange>(params: {
    onBlur?: string
    onChange?: T
    condition?: boolean
  }) =>
    ({
      onBlur: ({ value }: { value: string | string[] | number | object | boolean | null | undefined }) => {
        if (!value && (params.condition || true) && params.onBlur) {
          return params.onBlur
        }
      },
      onSubmit: ({ value }: { value: string | string[] | number | object | boolean | null | undefined }) => {
        if (
          params.condition &&
          typeof value === 'string' &&
          (value.trim() === '' || value === null || value === undefined)
        ) {
          return params.onBlur
        }
        if (
          params.condition &&
          typeof value === 'object' &&
          (value === null ||
            value === undefined ||
            Object.keys(value).length === 0 ||
            (Array.isArray(value) && !value.length))
        ) {
          return params.onBlur
        }
        return undefined
      },
      onChange: ({ value }: { value: string | string[] | number | object | boolean | null | undefined }) => {
        if (value) {
          try {
            if (params.onChange?.type === 'number') {
              z.number(`${params.onChange?.name} must be a number`)
                .gte(
                  params.onChange?.min,
                  `${params.onChange?.name} must be greater than or equal to ${params.onChange?.min}`
                )
                .parse(Number(value))
              return undefined // Valid
            }
            if (params.onChange?.type === 'integer') {
              z.int(`${params.onChange?.name} must be a whole number`)
                .gte(params.onChange?.min, `${params.onChange?.name} must be at least ${params.onChange?.min}`)
                .parse(Number(value))
              return undefined // Valid
            }
            if (params.onChange?.type === 'die') {
              console.log({ value, test: DIE_REGEX.test(value as string) })
              z.string()
                .regex(DIE_REGEX, `${params.onChange?.name} must be a valid die configuration (ex: 2d4)`)
                .parse(value)
              return undefined // Valid
            }
            if (params.onChange?.type === 'roll') {
              z.string()
                .regex(ROLL_CONFIG_REGEX, `${params.onChange?.name} must be a valid roll configuration (ex: 4d6dl1r1)`)
                .parse(value)
              return undefined // Valid
            }
            if (params.onChange?.type === 'string') {
              z.string(`${params.onChange?.name} is required`).parse(value)
              return undefined // Valid
            }
          } catch (error) {
            // Return the first error message
            if (error instanceof z.ZodError) {
              return error.issues[0]?.message || 'Validation failed'
            }
            return 'Validation failed'
          }
        }
        return undefined
      },
    }) as {
      onBlur: ({
        value,
      }: {
        value: string | string[] | number | object | boolean | null | undefined
      }) => string | undefined
      onSubmit: ({
        value,
      }: {
        value: string | string[] | number | object | boolean | null | undefined
      }) => string | undefined
      onChange: ({
        value,
      }: {
        value: string | string[] | number | object | boolean | null | undefined
      }) => ZodSchemaFor<T> | undefined
    }

  return {
    fieldListeners,
    fieldValidators,
  }
}

export default useFieldUpdates
