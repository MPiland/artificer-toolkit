import { z, ZodNumber, ZodString } from 'zod/v4'
import {
  useFeatureExpertiseStore,
  useFeatureOptionStore,
  useFeatureProficiencyStore,
  useFeatureSenseStore,
  useFeatureStore,
  useFeatureSpellStore,
  useFeatureFeatStore,
  useFeatureModifierStore,
  useAncestryOptionStore,
  useFormStore,
} from '@/store'
import type { AnyFieldApi } from '@tanstack/react-form'
import { DIE_REGEX, ROLL_CONFIG_REGEX } from '@/components/Form'
import { get } from 'lodash'

export const useFieldUpdates = ({
  data,
  path,
  stepIndex,
  replaceFn,
}: {
  data:
    | 'feature'
    | 'option'
    | 'ancestryOption'
    | 'proficiency'
    | 'expertise'
    | 'sense'
    | 'spell'
    | 'feat'
    | 'form'
    | 'modifier'
  path?: string
  stepIndex?: number
  replaceFn?: (name: string) => string
}) => {
  const formUpdateField = useFormStore((state) => state.updateField)
  const formSetFieldValidation = useFormStore((state) => state.setFieldValidation)
  const formUpdateDefaultValues = useFormStore((state) => state.updateDefaultValues)
  const formSteps = useFormStore((state) => state.steps)
  const formStepIndex = useFormStore((state) => state.stepIndex)

  const featureUpdateField = useFeatureStore((state) => state.updateField)
  const optionUpdateField = useFeatureOptionStore((state) => state.updateField)
  const ancestryOptionUpdateField = useAncestryOptionStore((state) => state.updateField)
  const proficiencyUpdateField = useFeatureProficiencyStore((state) => state.updateField)
  const expertiseUpdateField = useFeatureExpertiseStore((state) => state.updateField)
  const senseUpdateField = useFeatureSenseStore((state) => state.updateField)
  const spellUpdateField = useFeatureSpellStore((state) => state.updateField)
  const featUpdateField = useFeatureFeatStore((state) => state.updateField)
  const modifierUpdateField = useFeatureModifierStore((state) => state.updateField)

  const updateMap = {
    form: formUpdateField,
    feature: featureUpdateField,
    option: optionUpdateField,
    ancestryOption: ancestryOptionUpdateField,
    proficiency: proficiencyUpdateField,
    expertise: expertiseUpdateField,
    sense: senseUpdateField,
    spell: spellUpdateField,
    feat: featUpdateField,
    modifier: modifierUpdateField,
  }

  const handleBlur = ({
    target: { name, value },
    prevValue,
  }: {
    target: { name: string; value: string | string[] | number | boolean | object | null | undefined }
    prevValue: string | string[] | number | boolean | object | null | undefined
  }) => {
    const pathPrefix = replaceFn ? replaceFn(name) : path || ''
    const pathName =
      pathPrefix +
      (name.startsWith('[') ? ''
      : pathPrefix && pathPrefix !== '' ? '.'
      : '') +
      name
    updateMap[data]({ path: pathName, value })
    if (formSteps[formStepIndex].defaultValues && get(formSteps[formStepIndex].defaultValues, pathName) === undefined) {
      formUpdateDefaultValues({ path: pathName, value: prevValue })
    }
  }

  const fieldListeners = {
    // onBlurDebounceMs: 300,
    onBlur: ({
      value,
      fieldApi,
    }: {
      value: string | string[] | number | object | boolean | null | undefined
      fieldApi: AnyFieldApi
    }) => {
      if (stepIndex !== undefined && formSteps[stepIndex].fieldValidation) {
        formSetFieldValidation({ fieldName: fieldApi.name, isValid: fieldApi.state.meta.isValid })
      }
      handleBlur({
        target: { name: fieldApi.name, value },
        prevValue: fieldApi.options.defaultValue
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
