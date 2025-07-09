import { create } from 'zustand'
import type { FeatureOptionInput } from '@/types'
import { persist } from 'zustand/middleware'
import type { DeepKeys } from '@tanstack/react-form'
import { updateField, removeField } from './utils'

export interface OptionStore {
  current: FeatureOptionInput | null
  added: Map<string, FeatureOptionInput>
  edited: Map<string, FeatureOptionInput>
  removed: Set<string>
  setCurrent: (arg: FeatureOptionInput | null) => void
  upsertAdded: (arg: FeatureOptionInput) => void
  upsertEdited: (arg: FeatureOptionInput) => void
  remove: (id: string) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
}

export const useOptionStore = create<OptionStore>()(
  persist(
    (set) => {
      return {
        current: null,
        added: new Map<string, FeatureOptionInput>(),
        edited: new Map<string, FeatureOptionInput>(),
        removed: new Set<string>(),
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        upsertAdded: (option) =>
          set((state) => {
            const newMap = new Map(state.added)
            newMap.set(option.id, option)
            return { added: newMap }
          }),
        upsertEdited: (option) =>
          set((state) => {
            const newMap = new Map(state.edited)
            newMap.set(option.id, option)
            return { edited: newMap }
          }),
        remove: (id: string) =>
          set((state) => {
            const newSet = new Set(state.removed)
            newSet.add(id)
            return { removed: newSet }
          }),
        updateField: ({ path, value }) =>
          set((state: OptionStore) =>
            updateField<OptionStore, FeatureOptionInput>({
              path,
              value,
              selector: (state) => state.current as FeatureOptionInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: OptionStore) =>
            removeField<OptionStore, FeatureOptionInput>({
              path,
              selector: (state) => state.current as FeatureOptionInput,
            })(state)
          ),
      }
    },
    {
      name: 'atapp-option-store',
    }
  )
)
