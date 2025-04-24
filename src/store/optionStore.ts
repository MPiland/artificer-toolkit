import { create } from 'zustand'
import { addField, removeField, updateField, reset } from './utils'
import type { FeatureOption, DeepKeyOf } from '@/types'
import { produce } from 'immer'
import { persist } from 'zustand/middleware'

export interface OptionStore {
  data: FeatureOption
  index: number
  initData: FeatureOption
  updateField: (arg: { path: DeepKeyOf<FeatureOption>; value: any }) => void
  addField: (arg: { path: DeepKeyOf<FeatureOption>; value?: any }) => void
  removeField: (arg: { path: DeepKeyOf<FeatureOption> }) => void
  resetData: (arg: { value: FeatureOption }) => void
  resetInit: (arg: { value: FeatureOption }) => void
  setIndex: (arg: { value: number }) => void
  reinitState: (value?: FeatureOption) => void
}

export const useOptionStore = create<OptionStore>()(
  persist(
    (set) => {
      const defaultState: Pick<OptionStore, 'data' | 'initData' | 'index'> = {
        data: {} as FeatureOption,
        initData: {} as FeatureOption,
        index: 0,
      }

      return {
        ...defaultState,

        addField: ({ path, value }) =>
          set((state: OptionStore) =>
            addField<OptionStore, FeatureOption>({ path, value, selector: (state) => state.data })(state)
          ),

        removeField: ({ path }) =>
          set((state: OptionStore) =>
            removeField<OptionStore, FeatureOption>({ path, selector: (state) => state.data })(state)
          ),

        updateField: ({ path, value }) =>
          set((state: OptionStore) =>
            updateField<OptionStore, FeatureOption>({ path, value, selector: (state) => state.data })(state)
          ),

        resetData: ({ value }) =>
          set((state: OptionStore) =>
            reset<OptionStore, FeatureOption>({ value, selector: (state) => state.data })(state)
          ),

        resetInit: ({ value }) =>
          set((state: OptionStore) =>
            reset<OptionStore, FeatureOption>({ value, selector: (state) => state.initData })(state)
          ),

        setIndex: ({ value }) =>
          set((state) =>
            produce(state, (draft) => {
              draft.index = value
            })
          ),

        reinitState: (value?: FeatureOption) => {
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
