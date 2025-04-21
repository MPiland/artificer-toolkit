import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addField, removeField, updateField, reset } from './utils'
import type { AncestryFeature, Feature } from '../../amplify/gql/types'
import type { DeepKeyOf, FeatureTypes } from '../types/form'
import { produce } from 'immer'

export interface FeatureStore {
  // Core feature data
  data: Feature | AncestryFeature
  initData: Feature | AncestryFeature

  // Feature UI state
  index: number
  step: FeatureTypes | null

  updateField(arg: { path: DeepKeyOf<Feature | AncestryFeature>; value: any }): void
  addField(arg: { path: DeepKeyOf<Feature | AncestryFeature>; value?: any }): void
  removeField(arg: { path: DeepKeyOf<Feature | AncestryFeature> }): void
  resetData: (arg: { value: Feature | AncestryFeature }) => void
  resetInit: (arg: { value: Feature | AncestryFeature }) => void
  setIndex: (arg: { value: number }) => void
  setStep: (arg: FeatureTypes | null) => void
  reinitState: (value?: Feature | AncestryFeature) => void
}

export const useFeatureStore = create<FeatureStore>()(
  persist(
    (set) => {
      const defaultState: Pick<FeatureStore, 'data' | 'initData' | 'index' | 'step'> = {
        data: {} as Feature | AncestryFeature,
        initData: {} as Feature | AncestryFeature,
        step: null,
        index: 0,
      }

      return {
        ...defaultState,

        addField: ({ path, value }) =>
          set((state: FeatureStore) =>
            addField<FeatureStore, Feature | AncestryFeature>({ path, value, selector: (state) => state.data })(state)
          ),

        removeField: ({ path }) =>
          set((state: FeatureStore) =>
            removeField<FeatureStore, Feature | AncestryFeature>({ path, selector: (state) => state.data })(state)
          ),

        updateField: ({ path, value }) =>
          set((state: FeatureStore) =>
            updateField<FeatureStore, Feature | AncestryFeature>({ path, value, selector: (state) => state.data })(
              state
            )
          ),

        resetData: ({ value }) =>
          set((state: FeatureStore) =>
            reset<FeatureStore, Feature | AncestryFeature>({ value, selector: (state) => state.data })(state)
          ),

        resetInit: ({ value }) =>
          set((state: FeatureStore) =>
            reset<FeatureStore, Feature | AncestryFeature>({ value, selector: (state) => state.initData })(state)
          ),

        setIndex: ({ value }) =>
          set((state) =>
            produce(state, (draft) => {
              draft.index = value
            })
          ),

        setStep: (value) =>
          set((state) =>
            produce(state, (draft) => {
              draft.step = value
            })
          ),

        reinitState: (value?: Feature | AncestryFeature) => {
          if (value) {
            return set((state) => ({
              ...state,
              data: { ...value },
              initData: {
                ...value,
              },
            }))
          } else {
            return set((state) => ({
              ...state,
              data: { ...defaultState.data },
              initData: {
                ...defaultState.initData,
              },
              index: defaultState.index,
            }))
          }
        },
      }
    },
    {
      name: 'atapp-feature-store',
    }
  )
)
