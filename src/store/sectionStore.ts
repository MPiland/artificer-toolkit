import { create } from 'zustand'
import { addField, removeField, updateField, reset } from './utils'
import type { DeepKeyOf, SectionDataType, SectionName } from '../types/form'
import { produce } from 'immer'
import { persist } from 'zustand/middleware'

export interface SectionStore<T extends SectionDataType> {
  // Core section data
  data: T
  initData: T

  // Section UI state
  index: number
  step: SectionName | null

  updateField<T>(arg: { path: DeepKeyOf<T>; value: any }): void
  addField<T>(arg: { path: DeepKeyOf<T>; value?: any }): void
  removeField<T>(arg: { path: DeepKeyOf<T> }): void
  resetData: (arg: { value: T }) => void
  resetInit: (arg: { value: T }) => void
  setIndex: (arg: { value: number }) => void
  setStep: (arg: SectionName | null) => void
  reinitState: (value?: T) => void
}

export const useSectionStore = create<SectionStore<SectionDataType>>()(
  persist(
    (set) => {
      const defaultState: Pick<SectionStore<SectionDataType>, 'data' | 'initData' | 'index' | 'step'> = {
        data: {} as SectionDataType,
        initData: {} as SectionDataType,
        index: 0,
        step: null,
      }

      return {
        ...defaultState,

        addField: ({ path, value }) =>
          set((state: SectionStore<SectionDataType>) =>
            addField<SectionStore<SectionDataType>, SectionDataType>({ path, value, selector: (state) => state.data })(
              state
            )
          ),

        removeField: ({ path }) =>
          set((state: SectionStore<SectionDataType>) =>
            removeField<SectionStore<SectionDataType>, SectionDataType>({ path, selector: (state) => state.data })(
              state
            )
          ),

        updateField: ({ path, value }) =>
          set((state: SectionStore<SectionDataType>) =>
            updateField<SectionStore<SectionDataType>, SectionDataType>({
              path,
              value,
              selector: (state) => state.data,
            })(state)
          ),

        resetData: ({ value }) =>
          set((state: SectionStore<SectionDataType>) =>
            reset<SectionStore<SectionDataType>, SectionDataType>({ value, selector: (state) => state.data })(state)
          ),

        resetInit: ({ value }) =>
          set((state: SectionStore<SectionDataType>) =>
            reset<SectionStore<SectionDataType>, SectionDataType>({ value, selector: (state) => state.initData })(state)
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

        reinitState: (value?: SectionDataType) => {
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
              step: defaultState.step,
            }))
          }
        },
      }
    },
    {
      name: 'atapp-section-store',
    }
  )
)
