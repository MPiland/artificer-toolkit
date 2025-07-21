import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { FormDataType, Step } from '@/types'
import { updateField, removeField } from './utils'
import { persist } from 'zustand/middleware'
import { useFeatureStore } from './featureStore'
import { useFeatureOptionStore } from './featureOptionStore'
import { useFeatureSpellStore } from './featureSpellStore'
import { useFeatureFeatStore } from './featureFeatStore'
import { useFeatureSenseStore } from './featureSenseStore'
import { useFeatureProficiencyStore } from './featureProficiencyStore'
import { useFeatureExpertiseStore } from './featureExpertiseStore'
import { useFeatureModifierStore } from './featureModifierStore'
import { useAncestryOptionStore } from './ancestryOptionStore'
import { set as lSet } from 'lodash'

export interface FormStore<T extends FormDataType> {
  current: T | null
  saving: boolean
  stepIndex: number
  steps: (Step & {
    fieldValidation?: Record<string, boolean>
    defaultValues?: Partial<T>
  })[]
  addClass: boolean
  changeRace: boolean
  formReset: (values?: Partial<T>) => void
  resetStepFields: () => void
  setCurrent: (arg: T | null) => void
  setAddClass: (arg: boolean) => void
  setChangeRace: (arg: boolean) => void
  setSaving: (arg: boolean) => void
  setStepIndex: (arg: number) => void
  setSteps: (arg: Step[]) => void
  registerForm: (reset: () => void) => void
  updateDefaultValues: ({ path, value }: { path: string; value: unknown }) => void
  setFieldValidation: (args: { fieldName: string; isValid: boolean }) => void
  updateField(arg: { path: string; value: unknown }): void
  removeField(arg: { path: string }): void
  reset: () => void
}

export const useFormStore = create<FormStore<FormDataType>>()(
  persist(
    (set) => {
      return {
        current: null,
        saving: false,
        stepIndex: 0,
        steps: [],
        addClass: false,
        changeRace: false,
        formReset: () => undefined,
        resetStepFields: () =>
          set((state) => {
            const values = state.steps[state.stepIndex].defaultValues
            const newCurrentState = { ...state.current, ...values }
            state.formReset(newCurrentState)
            return {
              ...state,
              current: newCurrentState as FormDataType,
            }
          }),
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        setAddClass: (value) => set((state) => ({ ...state, addClass: value })),
        setChangeRace: (value) => set((state) => ({ ...state, changeRace: value })),
        setStepIndex: (value) => set((state) => ({ ...state, stepIndex: value })),
        setSaving: (value) => set((state) => ({ ...state, saving: value })),
        setSteps: (value) =>
          set((state) => {
            const stepArray = state.steps.filter((s) => value.some((step) => step.id === s.id))
            value.forEach((step) => {
              if (!stepArray.some((s) => s.id === step.id)) {
                stepArray.push({
                  ...step,
                  fieldValidation: undefined,
                  defaultValues: undefined,
                })
              }
            })
            return { ...state, steps: stepArray }
          }),
        registerForm: (reset) => set((state) => ({ ...state, formReset: reset })),
        setFieldValidation: ({ fieldName, isValid }) =>
          set((state) => {
            const stepArray = state.steps.map((step) => {
              if (step.id === state.steps[state.stepIndex].id) {
                return {
                  ...step,
                  fieldValidation:
                    step.fieldValidation ?
                      {
                        ...step.fieldValidation,
                        [fieldName]: isValid,
                      }
                    : undefined,
                }
              }
              return step
            })
            return { ...state, steps: stepArray }
          }),
        updateDefaultValues: ({ path, value }) =>
          set((state) => {
            const stepArray = state.steps.map((step) => {
              if (step.id === state.steps[state.stepIndex].id) {
                const defaultValues = { ...step.defaultValues }
                lSet(defaultValues, path, value)
                return {
                  ...step,
                  defaultValues,
                }
              }
              return step
            })
            return { ...state, steps: stepArray }
          }),
        updateField: ({ path, value }) =>
          set((state) =>
            updateField<FormStore<FormDataType>, FormDataType>({
              path,
              value,
              selector: (state) => state.current as FormDataType,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state) =>
            removeField<FormStore<FormDataType>, FormDataType>({
              path,
              selector: (state) => state.current as FormDataType,
            })(state)
          ),
        reset: () => {
          set((state) => ({ ...state, steps: [], current: null, stepIndex: 0, addClass: false, changeRace: false }))
          useFeatureStore.getState().reset()
          useFeatureOptionStore.getState().reset()
          useFeatureSenseStore.getState().reset()
          useFeatureSpellStore.getState().reset()
          useFeatureFeatStore.getState().reset()
          useFeatureSenseStore.getState().reset()
          useFeatureProficiencyStore.getState().reset()
          useFeatureExpertiseStore.getState().reset()
          useFeatureModifierStore.getState().reset()
          useAncestryOptionStore.getState().reset()
        },
      }
    },
    {
      name: 'atapp-form-store',
    }
  )
)

export type UseFormStore<T extends FormDataType> = UseBoundStore<StoreApi<FormStore<T>>>

export function useTypedFormStore<T extends FormDataType>() {
  return useFormStore as unknown as UseFormStore<T>
}
