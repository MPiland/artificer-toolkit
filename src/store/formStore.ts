import { create } from 'zustand'
import { DeepKeyOf, FormDataType, Step } from '@/types'
import { addField, removeField, updateField, reset } from './utils'
import { persist } from 'zustand/middleware'

export interface FormStore<T extends FormDataType> {
  // Core form data
  data: T
  initData: T

  // Form UI state
  ui: {
    saving: boolean
    stepIndex: number
    successMessage: string | null
    errorMessage: string | null
    steps: Step[]
    validForm: { [key: string]: boolean }
  }

  // Character builder specific state
  character: {
    addClass: boolean
    changeRace: boolean
  }

  // Actions remain at root level
  updateField<T>(arg: { path: DeepKeyOf<T>; value: unknown }): void
  addField<T>(arg: { path: DeepKeyOf<T>; value?: unknown }): void
  removeField<T>(arg: { path: DeepKeyOf<T> }): void
  resetData: (arg: { value: unknown }) => void
  resetInit: (arg: { value: unknown }) => void
  setAddClass: (arg: boolean) => void
  setChangeRace: (arg: boolean) => void
  setSaving: (arg: boolean) => void
  setStepIndex: (arg: number) => void
  setSuccessMessage: (arg: string | null) => void
  setErrorMessage: (arg: string | null) => void
  setSteps: (arg: Step[]) => void
  setValidForm: (arg: { [key: string]: boolean }) => void
  reinitState: (value?: FormDataType) => void
}

export const useFormStore = create<FormStore<FormDataType>>()(
  persist(
    (set) => {
      const defaultState: Pick<FormStore<FormDataType>, 'data' | 'initData' | 'ui' | 'character'> = {
        data: {} as FormDataType,
        initData: {} as FormDataType,
        ui: {
          saving: false,
          stepIndex: 0,
          successMessage: null,
          errorMessage: null,
          steps: [],
          validForm: {},
        },
        character: {
          addClass: false,
          changeRace: false,
        },
      }

      return {
        ...defaultState,

        addField({ path, value }) {
          set((state: FormStore<FormDataType>) =>
            addField<FormStore<FormDataType>, FormDataType>({
              path,
              value,
              selector: (state) => state.data as FormDataType,
            })(state)
          )
        },

        removeField: ({ path }) =>
          set((state: FormStore<FormDataType>) =>
            removeField<FormStore<FormDataType>, FormDataType>({
              path,
              selector: (state) => state.data as FormDataType,
            })(state)
          ),

        updateField: ({ path, value }) =>
          set((state: FormStore<FormDataType>) =>
            updateField<FormStore<FormDataType>, FormDataType>({
              path,
              value,
              selector: (state) => state.data as FormDataType,
            })(state)
          ),

        resetData: ({ value }) =>
          set((state: FormStore<FormDataType>) =>
            reset<FormStore<FormDataType>, FormDataType>({ value, selector: (state) => state.data as FormDataType })(
              state
            )
          ),

        resetInit: ({ value }) =>
          set((state: FormStore<FormDataType>) =>
            reset<FormStore<FormDataType>, FormDataType>({
              value,
              selector: (state) => state.initData as FormDataType,
            })(state)
          ),

        setAddClass: (value) => set((state) => ({ character: { ...state.character, addClass: value } })),

        setChangeRace: (value) => set((state) => ({ character: { ...state.character, changeRace: value } })),

        setStepIndex: (value) => set((state) => ({ ui: { ...state.ui, stepIndex: value } })),

        setSaving: (value) => set((state) => ({ ui: { ...state.ui, saving: value } })),

        setSuccessMessage: (value) => set((state) => ({ ui: { ...state.ui, successMessage: value } })),

        setErrorMessage: (value) => set((state) => ({ ui: { ...state.ui, errorMessage: value } })),

        setSteps: (value) => set((state) => ({ ui: { ...state.ui, steps: value } })),

        setValidForm: (value) =>
          set((state) => ({ ui: { ...state.ui, validForm: { ...state.ui.validForm, ...value } } })),

        reinitState: (value?: FormDataType) => {
          if (value) {
            return set((state) => ({
              ...state,
              data: value,
              initData: value,
            }))
          } else {
            return set(() => ({
              data: defaultState.data,
              initData: defaultState.initData,
              character: defaultState.character,
              ui: defaultState.ui,
            }))
          }
        },
      }
    },
    {
      name: 'atapp-form-store',
    }
  )
)
