import { create, type StoreApi, type UseBoundStore } from 'zustand'
import type { FormDataType, Step } from '~types'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { set as lSet, get as lGet } from 'lodash-es'
import type { SetOptional } from 'type-fest'

type FormMeta = {
  stepIndex: number
  steps: Step[]
  isDefaultValues: boolean
  isValid: boolean
  fieldMeta: MetaState
  addClass: boolean
  changeRace: boolean
  editing: {
    featureIndex: number | null
    sectionType: 'modifiers' | 'feats' | 'spells' | 'expertise' | 'proficiencies' | 'senses' | null
    sectionIndex: number | null
    optionIndex: number | null
    ancestryOptionIndex: number | null
  }
}

type FieldMeta = {
  stepIndex: number
  isDirty: boolean
  isTouched: boolean
  isValid: boolean
  errors: string[] | null
  isDefaultValue: boolean
  initialValue: unknown
}

interface UpdateFieldPayload {
  path: string
  value?: unknown
  errors?: string[] | null
  isValid?: boolean
}

type MetaState = Record<string, FieldMeta>

export interface FormStore<T extends SetOptional<FormDataType, '__kind'>> {
  current: T | null
  meta: FormMeta
  resetMeta: () => void
  setEditing: (updater: Partial<FormStore<T>['meta']['editing']>) => void
  formSubmit: (() => void) | null
  resetStepFields: () => void
  setCurrent: (arg: T | null) => void
  setInitialValue: (arg: T | null) => void
  setStepIndex: (arg: number) => void
  setSteps: (arg: Step[]) => void
  setAddClass: (value: boolean) => void
  setChangeRace: (value: boolean) => void
  registerForm: (handleSubmit: () => void) => void
  updateField: (arg: UpdateFieldPayload) => void
  reset: () => void
}

export const useFormStore = create<FormStore<SetOptional<FormDataType, '__kind'>>>()(
  persist(
    (set) => {
      return {
        current: null,
        meta: {
          stepIndex: 0,
          steps: [],
          isValid: true,
          fieldMeta: {} as MetaState,
          editing: {
            featureIndex: null,
            sectionIndex: null,
            sectionType: null,
            optionIndex: null,
            ancestryOptionIndex: null,
          },
          isDefaultValues: true,
          addClass: false,
          changeRace: false,
        },
        setEditing: (updater) =>
          set((state) => ({
            ...state,
            meta: {
              ...state.meta,
              editing: {
                ...state.meta.editing,
                ...updater,
              },
            },
          })),
        isDefaultValues: true,
        formSubmit: null,
        resetMeta: () =>
          set((state) => ({
            ...state,
            meta: {
              stepIndex: 0,
              steps: [],
              isValid: true,
              fieldMeta: {} as MetaState,
              editing: {
                featureIndex: null,
                sectionIndex: null,
                sectionType: null,
                optionIndex: null,
                ancestryOptionIndex: null,
              },
              isDefaultValues: true,
              addClass: false,
              changeRace: false,
            },
          })),
        resetStepFields: () =>
          set((state) => {
            const stepIndex = state.meta.stepIndex
            const updatedMeta: MetaState = { ...state.meta.fieldMeta }
            const updatedCurrent = { ...state.current } as FormDataType

            Object.entries(updatedMeta).forEach(([path, meta]) => {
              if (meta.stepIndex === stepIndex) {
                // Set the form field back to its initial value
                lSet(updatedCurrent, path, meta.initialValue)

                // Reset the meta state for the field
                updatedMeta[path] = {
                  ...meta,
                  isDirty: false,
                  isTouched: false,
                  isValid: true,
                  errors: null,
                  isDefaultValue: true,
                }
              }
            })

            const isDefaultValues = Object.values(updatedMeta).every((meta) => meta.isDefaultValue)

            return {
              ...state,
              current: updatedCurrent,
              meta: {
                ...state.meta,
                fieldMeta: updatedMeta,
                isDefaultValues,
              },
            }
          }),
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        setInitialValue: (value) => set((state) => ({ ...state, initialValue: value })),
        setStepIndex: (value) => set((state) => ({ ...state, stepIndex: value })),
        setSteps: (value) =>
          set((state) => {
            const stepArray = state.meta.steps.filter((s) => value.some((step) => step.id === s.id))
            value.forEach((step) => {
              if (!stepArray.some((s) => s.id === step.id)) {
                stepArray.push({
                  ...step,
                })
              }
            })
            return { ...state, steps: stepArray }
          }),
        setAddClass: (value) =>
          set((state) => ({
            ...state,
            meta: {
              ...state.meta,
              addClass: value,
            },
          })),
        setChangeRace: (value) =>
          set((state) => ({
            ...state,
            meta: {
              ...state.meta,
              changeRace: value,
            },
          })),
        registerForm: (handleSubmit) => set((state) => ({ ...state, formSubmit: handleSubmit })),
        updateField: ({ path, value, errors = null, isValid = true }: UpdateFieldPayload) =>
          set((state) => {
            const errorsEqual = (a: string[] | null, b: string[] | null): boolean => {
              if (a === b) return true
              if (!a || !b) return false
              if (a.length !== b.length) return false
              for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) return false
              }
              return true
            }

            const oldValue = lGet(state.current, path)
            const prevMeta = state.meta.fieldMeta[path]

            const valueChanged = oldValue !== value
            const errorsChanged = errorsEqual(prevMeta?.errors, errors)
            const isValidChanged = prevMeta?.isValid !== isValid

            if (!valueChanged && !errorsChanged && !isValidChanged) {
              return state // No changes
            }

            const updatedCurrent = (valueChanged ? { ...state.current } : state.current) as FormDataType
            if (valueChanged) lSet(updatedCurrent, path, value)

            const initialValue = prevMeta?.initialValue === undefined ? oldValue : prevMeta?.initialValue
            const isDefaultValue = value === initialValue
            const isDirty = (prevMeta?.isTouched ?? false) && !isDefaultValue

            const updatedMeta: FieldMeta = {
              stepIndex: state.meta.stepIndex,
              initialValue,
              isTouched: true,
              isDirty,
              isValid,
              errors,
              isDefaultValue,
            }

            const newMeta = { ...state.meta.fieldMeta, [path]: updatedMeta }

            const isDefaultValues = Object.values(newMeta).every((m) => m.isDefaultValue)

            const isFormValid = Object.values(newMeta).every((m) => m.isValid)

            return {
              ...state,
              current: updatedCurrent,
              meta: {
                ...state.meta,
                fieldMeta: newMeta,
                isDefaultValues,
                isValid: isFormValid,
              },
            }
          }),
        reset: () => {
          set((state) => ({
            ...state,
            current: null,
            meta: {
              stepIndex: 0,
              steps: [],
              isValid: true,
              editing: {
                featureIndex: null,
                sectionType: null,
                sectionIndex: null,
                optionIndex: null,
                ancestryOptionIndex: null,
              },
              initialValue: null,
              fieldMeta: {},
              isDefaultValues: true,
              addClass: false,
              changeRace: false,
            },
          }))
        },
      }
    },
    {
      name: 'atapp-form-store',
    }
  )
)

export type UseFormStore<T extends SetOptional<FormDataType, '__kind'>> = UseBoundStore<StoreApi<FormStore<T>>>

export function useTypedFormStore<T extends SetOptional<FormDataType, '__kind'>>() {
  return useFormStore as unknown as UseFormStore<T>
}

// Optimized store helpers with shallow comparison
export const useFormProperty = <T extends SetOptional<FormDataType, '__kind'>, K extends keyof T>(key: K) => {
  const store = useTypedFormStore<T>()
  return store(useShallow((state) => state.current?.[key]))
}

export const useFormProperties = <T extends SetOptional<FormDataType, '__kind'>, K extends keyof T>(keys: K[]) => {
  const store = useTypedFormStore<T>()
  return store(
    useShallow((state) => {
      if (!state.current) return null
      return keys.reduce(
        (acc, key) => {
          acc[key] = state.current![key]
          return acc
        },
        {} as Pick<T, K>
      )
    })
  )
}

// Modified useOptimizedSelector to accept a store argument
export const useOptimizedSelector = <T extends SetOptional<FormDataType, '__kind'>, R>(
  store: UseFormStore<T>, // Here, we pass the store as the first argument
  selector: (state: FormStore<T>) => R
) => {
  // The store call will now use the selector with shallow comparison
  return store(useShallow(selector))
}
