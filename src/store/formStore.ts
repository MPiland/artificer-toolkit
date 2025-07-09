import { create } from 'zustand'
import { FormDataType, Step } from '@/types'
import { updateField, removeField } from './utils'
import { persist } from 'zustand/middleware'

export interface FormStore {
  current: FormDataType | null
  resetState: FormDataType | null
  saving: boolean
  stepIndex: number
  steps: (Step & { isTouched: boolean; isValid: boolean; reset: () => void })[]
  addClass: boolean
  changeRace: boolean
  setCurrent: (arg: FormDataType | null) => void
  setResetState: (arg: FormDataType | null) => void
  setAddClass: (arg: boolean) => void
  setChangeRace: (arg: boolean) => void
  setSaving: (arg: boolean) => void
  setStepIndex: (arg: number) => void
  setSteps: (arg: Step[]) => void
  registerForm: (reset: () => void) => void
  setValidForm: (isValid: boolean) => void
  setTouchedForm: (isTouched: boolean) => void
  updateField(arg: { path: string; value: unknown }): void
  removeField(arg: { path: string }): void
}

export const useFormStore = create<FormStore>()(
  persist(
    (set) => {
      return {
        current: null,
        resetState: null,
        saving: false,
        stepIndex: 0,
        steps: [],
        addClass: false,
        changeRace: false,
        validSteps: null,
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        setResetState: (value) => set((state) => ({ ...state, resetState: value })),
        setAddClass: (value) => set((state) => ({ ...state, addClass: value })),
        setChangeRace: (value) => set((state) => ({ ...state, changeRace: value })),
        setStepIndex: (value) => set((state) => ({ ...state, stepIndex: value })),
        setSaving: (value) => set((state) => ({ ...state, saving: value })),
        setSteps: (value) =>
          set((state) => {
            const stepArray = state.steps.filter((s) => value.some((step) => step.id === s.id))
            value.forEach((step) => {
              if (!stepArray.some((s) => s.id === step.id)) {
                stepArray.push({ ...step, isTouched: false, isValid: true, reset: () => undefined })
              }
            })
            return { ...state, steps: stepArray }
          }),
        registerForm: (value) =>
          set((state) => {
            const stepArray = state.steps.map((step) => {
              if (step.id === state.steps[state.stepIndex].id) {
                return {
                  ...step,
                  reset: value,
                }
              }
              return step
            })
            return { ...state, steps: stepArray }
          }),
        setValidForm: (value) =>
          set((state) => {
            const stepArray = state.steps.map((step) => {
              if (step.id === state.steps[state.stepIndex].id) {
                return {
                  ...step,
                  isValid: value,
                }
              }
              return step
            })
            return { ...state, steps: stepArray }
          }),
        setTouchedForm: (value) =>
          set((state) => {
            const stepArray = state.steps.map((step) => {
              if (step.id === state.steps[state.stepIndex].id) {
                return {
                  ...step,
                  isTouched: value,
                }
              }
              return step
            })
            return { ...state, steps: stepArray }
          }),
        updateField: ({ path, value }) =>
          set((state) =>
            updateField<FormStore, FormDataType>({
              path,
              value,
              selector: (state) => state.current as FormDataType,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state) =>
            removeField<FormStore, FormDataType>({
              path,
              selector: (state) => state.current as FormDataType,
            })(state)
          ),
      }
    },
    {
      name: 'atapp-form-store',
    }
  )
)
