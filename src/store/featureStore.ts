import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addField, removeField, updateField, reset } from './utils'
import type { FeatureInput, AncestryFeatureInput, DeepKeyOf, FeatureTypes } from '@/types'
import { produce } from 'immer'

export interface FeatureStore {
  // Core Feature data
  data: FeatureInput | AncestryFeatureInput
  initData: FeatureInput | AncestryFeatureInput

  // Feature UI state
  index: number
  step: FeatureTypes | null

  updateField(arg: { path: DeepKeyOf<FeatureInput | AncestryFeatureInput>; value: any }): void
  addField(arg: { path: DeepKeyOf<FeatureInput | AncestryFeatureInput>; value?: any }): void
  removeField(arg: { path: DeepKeyOf<FeatureInput | AncestryFeatureInput> }): void
  resetData: (arg: { value: FeatureInput | AncestryFeatureInput }) => void
  resetInit: (arg: { value: FeatureInput | AncestryFeatureInput }) => void
  setIndex: (arg: { value: number }) => void
  setStep: (arg: FeatureTypes | null) => void
  reinitState: (value?: FeatureInput | AncestryFeatureInput) => void
}

export const useFeatureStore = create<FeatureStore>()(
  persist(
    (set) => {
      const defaultState: Pick<FeatureStore, 'data' | 'initData' | 'index' | 'step'> = {
        data: {} as FeatureInput | AncestryFeatureInput,
        initData: {} as FeatureInput | AncestryFeatureInput,
        step: null,
        index: 0,
      }

      return {
        ...defaultState,

        addField: ({ path, value }) =>
          set((state: FeatureStore) =>
            addField<FeatureStore, FeatureInput | AncestryFeatureInput>({
              path,
              value,
              selector: (state) => state.data,
            })(state)
          ),

        removeField: ({ path }) =>
          set((state: FeatureStore) =>
            removeField<FeatureStore, FeatureInput | AncestryFeatureInput>({ path, selector: (state) => state.data })(
              state
            )
          ),

        updateField: ({ path, value }) =>
          set((state: FeatureStore) =>
            updateField<FeatureStore, FeatureInput | AncestryFeatureInput>({
              path,
              value,
              selector: (state) => state.data,
            })(state)
          ),

        resetData: ({ value }) =>
          set((state: FeatureStore) =>
            reset<FeatureStore, FeatureInput | AncestryFeatureInput>({ value, selector: (state) => state.data })(state)
          ),

        resetInit: ({ value }) =>
          set((state: FeatureStore) =>
            reset<FeatureStore, FeatureInput | AncestryFeatureInput>({ value, selector: (state) => state.initData })(
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

        reinitState: (value?: FeatureInput | AncestryFeatureInput) => {
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
      name: 'atapp-Feature-store',
    }
  )
)
