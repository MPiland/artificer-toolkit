import { StateCreator } from 'zustand'
import { addField, removeField, updateField, reset, CombinedSlice } from './useStore'
import { FeatureSubfeature } from '../../amplify/gql/types'
import { DeepKeyOf } from '../types/form'
import { produce } from 'immer'

export interface SubfeatureSlice {
  subfeatureData: FeatureSubfeature
  subfeatureIndex: number
  initialSubfeatureData: FeatureSubfeature
  updateSubfeatureField: (arg: { path: DeepKeyOf<FeatureSubfeature>; value: any }) => void
  addSubfeatureField: (arg: { path: DeepKeyOf<FeatureSubfeature>; value?: any }) => void
  removeSubfeatureField: (arg: { path: DeepKeyOf<FeatureSubfeature> }) => void
  subfeatureReset: (arg: { value: FeatureSubfeature }) => void
  initialSubfeatureReset: (arg: { value: FeatureSubfeature }) => void
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
