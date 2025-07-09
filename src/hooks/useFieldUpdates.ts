import { z } from 'zod/v4'
import { get, isEqual } from 'lodash'
import {
  useAncestryStore,
  useExpertiseStore,
  useFormStore,
  useModifierStore,
  useOptionStore,
  useProficiencyStore,
  useSenseStore,
  useSpellStore,
  useFeatStore,
} from '@/store'
import type { AnyFieldApi } from '@tanstack/react-form'
import { DIE_REGEX, ROLL_CONFIG_REGEX } from '@/components/Form'

const useFieldUpdates = ({
  data,
  path,
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
  replaceFn?: (name: string) => string
}) => {
  const formStore = useFormStore()
  const featureStore = useFeatStore()
  const optionStore = useOptionStore()
  const ancestryStore = useAncestryStore()
  const proficiencyStore = useProficiencyStore()
  const expertiseStore = useExpertiseStore()
  const senseStore = useSenseStore()
  const spellStore = useSpellStore()
  const modifierStore = useModifierStore()

  const currentTypeMap = {
    form: formStore.current,
    feature: featureStore.current,
    option: optionStore.current,
    ancestryOption: ancestryStore.current,
    proficiency: proficiencyStore.current,
    expertise: expertiseStore.current,
    sense: senseStore.current,
    spell: spellStore.current,
    modifier: modifierStore.current,
    feat: featureStore.current,
  }

  const handleBlur = ({
    target: { name, value },
  }: {
    target: { name: string; value: string | string[] | number | boolean | object | null | undefined }
  }) => {
    const pathName = replaceFn ? replaceFn(name) : path || '' + (name.startsWith('[') ? '' : '.') + name
    const currentValue = get(currentTypeMap[data], pathName)
    if (value != null && !isEqual(currentValue, value)) {
      formStore.updateField({ path: pathName, value })
    } else if (currentValue && value == null) {
      formStore.removeField({ path: pathName })
    }
  }

  const fieldListeners = {
    onBlur: ({
      value,
      fieldApi,
    }: {
      value: string | string[] | number | object | boolean | null | undefined
      fieldApi: AnyFieldApi
    }) => {
      if (!fieldApi.state.meta.isDefaultValue) {
        formStore.setTouchedForm(true)
        if (fieldApi.state.meta.isValid) {
          handleBlur({ target: { name: fieldApi.name, value } })
        } else {
          formStore.setValidForm(false)
        }
      }
    },
  }

  const fieldValidators = ({
    onBlur,
    onChange,
    condition = true,
  }: {
    onBlur?: string
    onChange?: { type: 'number' | 'integer' | 'die' | 'roll' | 'string'; min?: number; name: string }
    condition?: boolean
  }) => ({
    onBlur: (value: string | string[] | number | object | boolean | null | undefined) => !value && condition && onBlur,
    onSubmit: (value: string | string[] | number | object | boolean | null | undefined) => {
      if (condition && typeof value === 'string' && (value.trim() === '' || value === null || value === undefined)) {
        formStore.setValidForm(false)
        return onBlur
      }
      if (
        condition &&
        typeof value === 'object' &&
        (value === null ||
          value === undefined ||
          Object.keys(value).length === 0 ||
          (Array.isArray(value) && !value.length))
      ) {
        formStore.setValidForm(false)
        return onBlur
      }
    },
    onChange: () => {
      if (onChange?.type === 'number') {
        return z
          .number(`${onChange?.name} must be a number`)
          .gte(onChange?.min || 0, `${onChange?.name} must be greater than or equal to ${onChange?.min || 0}`)
      }
      if (onChange?.type === 'integer') {
        return z
          .int(`${onChange?.name} must be a whole number`)
          .gte(onChange?.min || 0, `${onChange?.name} must be at least ${onChange?.min || 0}`)
      }
      if (onChange?.type === 'die') {
        return z.string().regex(DIE_REGEX, `${onChange?.name} must be a valid die configuration (ex: 2d4)`)
      }
      if (onChange?.type === 'roll') {
        return z
          .string()
          .regex(ROLL_CONFIG_REGEX, `${onChange?.name} must be a valid roll configuration (ex: 4d6dl1r1)`)
      }
    },
  })

  return {
    fieldListeners,
    fieldValidators,
  }
}

export default useFieldUpdates
