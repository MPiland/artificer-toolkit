import { StateCreator } from 'zustand'
import { DeepKeyOf, FormDataType } from '../types/form'
import { addField, removeField, updateField, reset, CombinedSlice } from './useStore'

export interface FormSlice {
  formData: FormDataType
  initialFormData: FormDataType
  updateFormField: (arg: { path: DeepKeyOf<FormDataType>; value: any }) => void
  addFormField: (arg: { path: DeepKeyOf<FormDataType>; value?: any }) => void
  removeFormField: (arg: { path: DeepKeyOf<FormDataType> }) => void
  formReset: (arg: { value: any }) => void
  initialFormReset: (arg: { value: any }) => void
}

export const formSlice: StateCreator<CombinedSlice, [], [], FormSlice> = (set) => ({
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

  addFormField: ({ path, value }) =>
    set((state) => addField({ path, value, selector: (state) => state.formData })(state)),

  removeFormField: ({ path }) => set((state) => removeField({ path, selector: (state) => state.formData })(state)),

  updateFormField: ({ path, value }) =>
    set((state) => updateField({ path, value, selector: (state) => state.formData })(state)),

  formReset: ({ value }) => set((state) => reset({ value, selector: (state) => state.formData })(state)),

  initialFormReset: ({ value }) => set((state) => reset({ value, selector: (state) => state.initialFormData })(state)),
})
