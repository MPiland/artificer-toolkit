import { create } from 'zustand'
import { addField, removeField, updateField, reset } from './utils'
import type { AncestryOption } from '@/types/types'
import type { DeepKeyOf } from '@/types/form'
import { produce } from 'immer'
import { persist } from 'zustand/middleware'

export interface AncestryStore {
  data: AncestryOption
  index: number
  initData: AncestryOption
  updateField(arg: { path: DeepKeyOf<AncestryOption>; value: any }): void
  addField(arg: { path: DeepKeyOf<AncestryOption>; value: any }): void
  removeField(arg: { path: DeepKeyOf<AncestryOption> }): void
  resetData: (arg: { value: AncestryOption }) => void
  resetInit: (arg: { value: AncestryOption }) => void
  setIndex: (arg: { value: number }) => void
  reinitState: (value?: AncestryOption) => void
}

export const useAncestryStore = create<AncestryStore>()(
  persist(
    (set) => {
      const defaultState: Pick<AncestryStore, 'data' | 'initData' | 'index'> = {
        data: {} as AncestryOption,
        initData: {} as AncestryOption,
        index: 0,
      }
      return {
        ...defaultState,

        addField: ({ path, value }) =>
          set((state: AncestryStore) =>
            addField<AncestryStore, AncestryOption>({ path, value, selector: (state) => state.data })(state)
          ),

        removeField: ({ path }) =>
          set((state: AncestryStore) =>
            removeField<AncestryStore, AncestryOption>({ path, selector: (state) => state.data })(state)
          ),

        updateField: ({ path, value }) =>
          set((state: AncestryStore) =>
            updateField<AncestryStore, AncestryOption>({ path, value, selector: (state) => state.data })(state)
          ),

        resetData: ({ value }) =>
          set((state: AncestryStore) =>
            reset<AncestryStore, AncestryOption>({ value, selector: (state) => state.data })(state)
          ),

        resetInit: ({ value }) =>
          set((state: AncestryStore) =>
            reset<AncestryStore, AncestryOption>({ value, selector: (state) => state.initData })(state)
          ),

        setIndex: ({ value }) =>
          set((state) =>
            produce(state, (draft) => {
              draft.index = value
            })
          ),

        reinitState: (value?: AncestryOption) => {
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
      name: 'atapp-ancestry-store',
    }
  )
)
