import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addField, removeField, updateField, reset } from './utils'
import type { GQL, DeepKeyOf, FeatureTypes } from '@/types'
import { produce } from 'immer'

export interface FeatureStore {
  // Core GQL.Feature data
  data: GQL.Feature | GQL.AncestryFeature
  initData: GQL.Feature | GQL.AncestryFeature

  // GQL.Feature UI state
  index: number
  step: FeatureTypes | null

  updateField(arg: { path: DeepKeyOf<GQL.Feature | GQL.AncestryFeature>; value: any }): void
  addField(arg: { path: DeepKeyOf<GQL.Feature | GQL.AncestryFeature>; value?: any }): void
  removeField(arg: { path: DeepKeyOf<GQL.Feature | GQL.AncestryFeature> }): void
  resetData: (arg: { value: GQL.Feature | GQL.AncestryFeature }) => void
  resetInit: (arg: { value: GQL.Feature | GQL.AncestryFeature }) => void
  setIndex: (arg: { value: number }) => void
  setStep: (arg: FeatureTypes | null) => void
  reinitState: (value?: GQL.Feature | GQL.AncestryFeature) => void
}

export const useFeatureStore = create<FeatureStore>()(
  persist(
    (set) => {
      const defaultState: Pick<FeatureStore, 'data' | 'initData' | 'index' | 'step'> = {
        data: {} as GQL.Feature | GQL.AncestryFeature,
        initData: {} as GQL.Feature | GQL.AncestryFeature,
        step: null,
        index: 0,
      }

      return {
        ...defaultState,

        addField: ({ path, value }) =>
          set((state: FeatureStore) =>
            addField<FeatureStore, GQL.Feature | GQL.AncestryFeature>({ path, value, selector: (state) => state.data })(
              state
            )
          ),

        removeField: ({ path }) =>
          set((state: FeatureStore) =>
            removeField<FeatureStore, GQL.Feature | GQL.AncestryFeature>({ path, selector: (state) => state.data })(
              state
            )
          ),

        updateField: ({ path, value }) =>
          set((state: FeatureStore) =>
            updateField<FeatureStore, GQL.Feature | GQL.AncestryFeature>({
              path,
              value,
              selector: (state) => state.data,
            })(state)
          ),

        resetData: ({ value }) =>
          set((state: FeatureStore) =>
            reset<FeatureStore, GQL.Feature | GQL.AncestryFeature>({ value, selector: (state) => state.data })(state)
          ),

        resetInit: ({ value }) =>
          set((state: FeatureStore) =>
            reset<FeatureStore, GQL.Feature | GQL.AncestryFeature>({ value, selector: (state) => state.initData })(
              state
            )
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

        reinitState: (value?: GQL.Feature | GQL.AncestryFeature) => {
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
      name: 'atapp-GQL.Feature-store',
    }
  )
)
