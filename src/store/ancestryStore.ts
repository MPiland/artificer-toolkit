import { create } from 'zustand'
import { addField, removeField, updateField, reset } from './utils'
import type { DeepKeyOf, AncestryOptionInput } from '@/types'
import { produce } from 'immer'
import { persist } from 'zustand/middleware'

export interface AncestryStore {
  data: AncestryOptionInput
  index: number
  initData: AncestryOptionInput
  updateField(arg: { path: DeepKeyOf<AncestryOptionInput>; value: any }): void
  addField(arg: { path: DeepKeyOf<AncestryOptionInput>; value: any }): void
  removeField(arg: { path: DeepKeyOf<AncestryOptionInput> }): void
  resetData: (arg: { value: AncestryOptionInput }) => void
  resetInit: (arg: { value: AncestryOptionInput }) => void
  setIndex: (arg: { value: number }) => void
  reinitState: (value?: AncestryOptionInput) => void
}

export const useAncestryStore = create<AncestryStore>()(
  persist(
    (set) => {
      const defaultState: Pick<AncestryStore, 'data' | 'initData' | 'index'> = {
        data: {} as AncestryOptionInput,
        initData: {} as AncestryOptionInput,
        index: 0,
      }
      return {
        ...defaultState,

        addField: ({ path, value }) =>
          set((state: AncestryStore) =>
            addField<AncestryStore, AncestryOptionInput>({ path, value, selector: (state) => state.data })(state)
          ),

        removeField: ({ path }) =>
          set((state: AncestryStore) =>
            removeField<AncestryStore, AncestryOptionInput>({ path, selector: (state) => state.data })(state)
          ),

        updateField: ({ path, value }) =>
          set((state: AncestryStore) =>
            updateField<AncestryStore, AncestryOptionInput>({ path, value, selector: (state) => state.data })(state)
          ),

        resetData: ({ value }) =>
          set((state: AncestryStore) =>
            reset<AncestryStore, AncestryOptionInput>({ value, selector: (state) => state.data })(state)
          ),

        resetInit: ({ value }) =>
          set((state: AncestryStore) =>
            reset<AncestryStore, AncestryOptionInput>({ value, selector: (state) => state.initData })(state)
          ),

        setIndex: ({ value }) =>
          set((state) =>
            produce(state, (draft) => {
              draft.index = value
            })
          ),

        reinitState: (value?: AncestryOptionInput) => {
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
