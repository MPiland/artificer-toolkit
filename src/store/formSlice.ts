import { StateCreator } from 'zustand'
import { DeepKeyOf, FormDataType, Step } from '../types/form'
import { addField, removeField, updateField, reset, CombinedSlice } from './useStore'

export interface FormSlice {
  // Core form data
  formData: FormDataType
  initialFormData: FormDataType

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
  updateFormField: (arg: { path: DeepKeyOf<FormDataType>; value: any }) => void
  addFormField: (arg: { path: DeepKeyOf<FormDataType>; value?: any }) => void
  removeFormField: (arg: { path: DeepKeyOf<FormDataType> }) => void
  formReset: (arg: { value: any }) => void
  initialFormReset: (arg: { value: any }) => void
  setAddClass: (arg: boolean) => void
  setChangeRace: (arg: boolean) => void
  setSaving: (arg: boolean) => void
  setStepIndex: (arg: number) => void
  setSuccessMessage: (arg: string | null) => void
  setErrorMessage: (arg: string | null) => void
  setSteps: (arg: Step[]) => void
  setValidForm: (arg: { [key: string]: boolean }) => void
  resetForm: () => void
}

export const formSlice: StateCreator<CombinedSlice, [], [], FormSlice> = (set) => {
  const defaultState: Pick<FormSlice, 'formData' | 'initialFormData' | 'ui' | 'character'> = {
    formData: {
      id: undefined,
      value: undefined,
      label: undefined,
      __typename: undefined,
      systemId: undefined,
      ownerId: undefined,
    },
    initialFormData: {
      id: undefined,
      value: undefined,
      label: undefined,
      __typename: undefined,
      systemId: undefined,
      ownerId: undefined,
    },
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

    addFormField: ({ path, value }) =>
      set((state) => addField({ path, value, selector: (state) => state.formData })(state)),

    removeFormField: ({ path }) => set((state) => removeField({ path, selector: (state) => state.formData })(state)),

    updateFormField: ({ path, value }) =>
      set((state) => updateField({ path, value, selector: (state) => state.formData })(state)),

    formReset: ({ value }) => set((state) => reset({ value, selector: (state) => state.formData })(state)),

    initialFormReset: ({ value }) =>
      set((state) => reset({ value, selector: (state) => state.initialFormData })(state)),

    setAddClass: (value) => set((state) => ({ character: { ...state.character, addClass: value } })),

    setChangeRace: (value) => set((state) => ({ character: { ...state.character, changeRace: value } })),

    setStepIndex: (value) => set((state) => ({ ui: { ...state.ui, stepIndex: value } })),

    setSaving: (value) => set((state) => ({ ui: { ...state.ui, saving: value } })),

    setSuccessMessage: (value) => set((state) => ({ ui: { ...state.ui, successMessage: value } })),

    setErrorMessage: (value) => set((state) => ({ ui: { ...state.ui, errorMessage: value } })),

    setSteps: (value) => set((state) => ({ ui: { ...state.ui, steps: value } })),

    setValidForm: (value) => set((state) => ({ ui: { ...state.ui, validForm: { ...state.ui.validForm, ...value } } })),

    resetForm: () =>
      set(() => ({
        formData: defaultState.formData,
        initialFormData: defaultState.initialFormData,
        character: defaultState.character,
        ui: defaultState.ui,
      })),
  }
}
