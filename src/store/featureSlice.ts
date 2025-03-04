import { StateCreator } from 'zustand'
import { addField, removeField, updateField, reset, CombinedSlice } from './useStore'
import { Feature } from '../../amplify/gql/types'
import { DeepKeyOf, FeatureTypes } from '../types/form'
import { produce } from 'immer'

export interface FeatureSlice {
  // Core feature data
  featureData: Feature
  initialFeatureData: Feature

  // Feature UI state
  featureIndex: number
  featureStep: FeatureTypes | null

  updateFeatureField: (arg: { path: DeepKeyOf<Feature>; value: any }) => void
  addFeatureField: (arg: { path: DeepKeyOf<Feature>; value?: any }) => void
  removeFeatureField: (arg: { path: DeepKeyOf<Feature> }) => void
  featureReset: (arg: { value: Feature }) => void
  initialFeatureReset: (arg: { value: Feature }) => void
  updateFeatureIndex: (arg: { value: number }) => void
  setFeatureStep: (arg: FeatureTypes) => void
  resetFeature: () => void
}

export const featureSlice: StateCreator<CombinedSlice, [], [], FeatureSlice> = (set) => {
  const defaultState: Pick<FeatureSlice, 'featureData' | 'initialFeatureData' | 'featureIndex' | 'featureStep'> = {
    featureData: { id: undefined, value: undefined, label: undefined, __typename: 'Feature' },

    initialFeatureData: { id: undefined, value: undefined, label: undefined, __typename: 'Feature' },

    featureStep: null,

    featureIndex: 0,
  }

  return {
    ...defaultState,

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

    setFeatureStep: (value) =>
      set((state) =>
        produce(state, (draft) => {
          draft.featureStep = value
        })
      ),

    resetFeature: () =>
      set(() => ({
        featureData: defaultState.featureData,
        initialFeatureData: defaultState.initialFeatureData,
        featureIndex: defaultState.featureIndex,
        featureStep: defaultState.featureStep,
      })),
  }
}
