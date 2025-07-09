import { create } from 'zustand'
import type { FeatureFeatInput } from '@/types'
import { persist } from 'zustand/middleware'
import { updateField, removeField } from './utils'
import type { DeepKeys } from '@tanstack/react-form'

export interface FeatStore {
  current: FeatureFeatInput | null
  added: Map<string, FeatureFeatInput>
  edited: Map<string, FeatureFeatInput>
  removed: Set<string>
  setCurrent: (arg: FeatureFeatInput | null) => void
  upsertAdded: (arg: FeatureFeatInput) => void
  upsertEdited: (arg: FeatureFeatInput) => void
  remove: (id: string) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
}

export const useFeatStore = create<FeatStore>()(
  persist(
    (set) => {
      return {
        current: null,
        added: new Map<string, FeatureFeatInput>(),
        edited: new Map<string, FeatureFeatInput>(),
        removed: new Set<string>(),
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        upsertAdded: (feat) =>
          set((state) => {
            const newMap = new Map(state.added)
            newMap.set(feat.id, feat)
            return { added: newMap }
          }),
        upsertEdited: (feat) =>
          set((state) => {
            const newMap = new Map(state.edited)
            newMap.set(feat.id, feat)
            return { edited: newMap }
          }),
        remove: (id: string) =>
          set((state) => {
            const newSet = new Set(state.removed)
            newSet.add(id)
            return { removed: newSet }
          }),
        updateField: ({ path, value }) =>
          set((state: FeatStore) =>
            updateField<FeatStore, FeatureFeatInput>({
              path,
              value,
              selector: (state) => state.current as FeatureFeatInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: FeatStore) =>
            removeField<FeatStore, FeatureFeatInput>({
              path,
              selector: (state) => state.current as FeatureFeatInput,
            })(state)
          ),
      }
    },
    {
      name: 'atapp-section-store',
    }
  )
)
