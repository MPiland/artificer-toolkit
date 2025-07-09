import { create } from 'zustand'
import type { FeatureSenseInput } from '@/types'
import { persist } from 'zustand/middleware'
import { updateField, removeField } from './utils'
import type { DeepKeys } from '@tanstack/react-form'

export interface SenseStore {
  current: FeatureSenseInput | null
  added: Map<string, FeatureSenseInput>
  edited: Map<string, FeatureSenseInput>
  removed: Set<string>
  setCurrent: (arg: FeatureSenseInput | null) => void
  upsertAdded: (arg: FeatureSenseInput) => void
  upsertEdited: (arg: FeatureSenseInput) => void
  removeSense: (id: string) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
}

export const useSenseStore = create<SenseStore>()(
  persist(
    (set) => {
      return {
        current: null,
        added: new Map<string, FeatureSenseInput>(),
        edited: new Map<string, FeatureSenseInput>(),
        removed: new Set<string>(),
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        upsertAdded: (sense) =>
          set((state) => {
            const newMap = new Map(state.added)
            newMap.set(sense.id, sense)
            return { added: newMap }
          }),
        upsertEdited: (sense) =>
          set((state) => {
            const newMap = new Map(state.edited)
            newMap.set(sense.id, sense)
            return { edited: newMap }
          }),
        removeSense: (id: string) =>
          set((state) => {
            const newSet = new Set(state.removed)
            newSet.add(id)
            return { removed: newSet }
          }),
        updateField: ({ path, value }) =>
          set((state: SenseStore) =>
            updateField<SenseStore, FeatureSenseInput>({
              path,
              value,
              selector: (state) => state.current as FeatureSenseInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: SenseStore) =>
            removeField<SenseStore, FeatureSenseInput>({
              path,
              selector: (state) => state.current as FeatureSenseInput,
            })(state)
          ),
      }
    },
    {
      name: 'atapp-section-store',
    }
  )
)
