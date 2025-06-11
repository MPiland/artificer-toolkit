import { create } from 'zustand'
import { addField, removeField, updateField, reset } from './utils'
import type { FeatureOptionInput, DeepKeyOf } from '@/types'
import { produce } from 'immer'
import { persist } from 'zustand/middleware'

export interface OptionStore {
  data: FeatureOptionInput
  index: number
  initData: FeatureOptionInput
  updateField: (arg: { path: DeepKeyOf<FeatureOptionInput>; value: any }) => void
  addField: (arg: { path: DeepKeyOf<FeatureOptionInput>; value?: any }) => void
  removeField: (arg: { path: DeepKeyOf<FeatureOptionInput> }) => void
  resetData: (arg: { value: FeatureOptionInput }) => void
  resetInit: (arg: { value: FeatureOptionInput }) => void
  setIndex: (arg: { value: number }) => void
  reinitState: (value?: FeatureOptionInput) => void
}

export const useOptionStore = create<OptionStore>()(
  persist(
    (set) => {
      const defaultState: Pick<OptionStore, 'data' | 'initData' | 'index'> = {
        data: {} as FeatureOptionInput,
        initData: {} as FeatureOptionInput,
        index: 0,
      }

      return {
        ...defaultState,

        addField: ({ path, value }) =>
          set((state: OptionStore) =>
            addField<OptionStore, FeatureOptionInput>({ path, value, selector: (state) => state.data })(state)
          ),

        removeField: ({ path }) =>
          set((state: OptionStore) =>
            removeField<OptionStore, FeatureOptionInput>({ path, selector: (state) => state.data })(state)
          ),

        updateField: ({ path, value }) =>
          set((state: OptionStore) =>
            updateField<OptionStore, FeatureOptionInput>({ path, value, selector: (state) => state.data })(state)
          ),

        resetData: ({ value }) =>
          set((state: OptionStore) =>
            reset<OptionStore, FeatureOptionInput>({ value, selector: (state) => state.data })(state)
          ),

        resetInit: ({ value }) =>
          set((state: OptionStore) =>
            reset<OptionStore, FeatureOptionInput>({ value, selector: (state) => state.initData })(state)
          ),

        setIndex: ({ value }) =>
          set((state) =>
            produce(state, (draft) => {
              draft.index = value
            })
          ),

        reinitState: (value?: FeatureOptionInput) => {
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
              index: defaultState.index,
            }))
          }
        },
      }
    },
    {
      name: 'atapp-option-store',
    }
  )
)
