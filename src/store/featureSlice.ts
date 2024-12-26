import { StateCreator } from 'zustand'
import { addField, removeField, updateField, reset, CombinedSlice } from './useStore'
import { Feature } from '../../amplify/API'
import { DeepKeyOf } from '../types/form'
import { produce } from 'immer'

export interface FeatureSlice {
  featureData: Feature
  initialFeatureData: Feature
  featureIndex: number
  updateFeatureField: (arg: { path: DeepKeyOf<Feature>; value: any }) => void
  addFeatureField: (arg: { path: DeepKeyOf<Feature>; value?: any }) => void
  removeFeatureField: (arg: { path: DeepKeyOf<Feature> }) => void
  featureReset: (arg: { value: Feature }) => void
  initialFeatureReset: (arg: { value: Feature }) => void
  updateFeatureIndex: (arg: { value: number }) => void
}

export const featureSlice: StateCreator<CombinedSlice, [], [], FeatureSlice> = (set) => ({
  featureData: { id: undefined, value: undefined, label: undefined, __typename: undefined },

  initialFeatureData: { id: undefined, value: undefined, label: undefined, __typename: undefined },

  featureIndex: 0,

  addFeatureField: ({ path, value }) =>
    set((state) => addField({ path, value, selector: (state) => state.featureData })(state)),

  removeFeatureField: ({ path }) =>
    set((state) => removeField({ path, selector: (state) => state.featureData })(state)),

  updateFeatureField: ({ path, value }) =>
    set((state) => updateField({ path, value, selector: (state) => state.featureData })(state)),

  featureReset: ({ value }) => set((state) => reset({ value, selector: (state) => state.featureData })(state)),

  initialFeatureReset: ({ value }) =>
    set((state) => reset({ value, selector: (state) => state.initialFeatureData })(state)),

  updateFeatureIndex: ({ value }) =>
    set((state) =>
      produce(state, (draft) => {
        draft.featureIndex = value
      })
    ),
})
