import { StateCreator } from 'zustand'
import { addField, removeField, updateField, reset, CombinedSlice } from './useStore'
import { Subfeature } from '../../amplify/gql/types'
import { DeepKeyOf } from '../types/form'
import { produce } from 'immer'

export interface SubfeatureSlice {
  subfeatureData: Subfeature
  subfeatureIndex: number
  initialSubfeatureData: Subfeature
  updateSubfeatureField: (arg: { path: DeepKeyOf<Subfeature>; value: any }) => void
  addSubfeatureField: (arg: { path: DeepKeyOf<Subfeature>; value?: any }) => void
  removeSubfeatureField: (arg: { path: DeepKeyOf<Subfeature> }) => void
  subfeatureReset: (arg: { value: Subfeature }) => void
  initialSubfeatureReset: (arg: { value: Subfeature }) => void
  updateSubfeatureIndex: (arg: { value: number }) => void
  resetSubfeature: () => void
}

export const subfeatureSlice: StateCreator<CombinedSlice, [], [], SubfeatureSlice> = (set) => {
  const defaultState: Pick<SubfeatureSlice, 'subfeatureData' | 'initialSubfeatureData' | 'subfeatureIndex'> = {
    subfeatureData: { id: undefined, value: undefined, label: undefined, __typename: undefined },

    initialSubfeatureData: { id: undefined, value: undefined, label: undefined, __typename: undefined },

    subfeatureIndex: 0,
  }
  return {
    ...defaultState,

    addSubfeatureField: ({ path, value }) =>
      set((state) => addField({ path, value, selector: (state) => state.subfeatureData })(state)),

    removeSubfeatureField: ({ path }) =>
      set((state) => removeField({ path, selector: (state) => state.subfeatureData })(state)),

    updateSubfeatureField: ({ path, value }) =>
      set((state) => updateField({ path, value, selector: (state) => state.subfeatureData })(state)),

    subfeatureReset: ({ value }) => set((state) => reset({ value, selector: (state) => state.subfeatureData })(state)),

    initialSubfeatureReset: ({ value }) =>
      set((state) => reset({ value, selector: (state) => state.initialSubfeatureData })(state)),

    updateSubfeatureIndex: ({ value }) =>
      set((state) =>
        produce(state, (draft) => {
          draft.subfeatureIndex = value
        })
      ),

    resetSubfeature: () =>
      set((state) => ({
        ...state,
        subfeatureData: defaultState.subfeatureData,
        initialSubfeatureData: defaultState.initialSubfeatureData,
        subfeatureIndex: defaultState.subfeatureIndex,
      })),
  }
}
