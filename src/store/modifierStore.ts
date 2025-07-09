import { create } from 'zustand'
import type { FeatureModifierInput } from '@/types'
import { persist } from 'zustand/middleware'
import { updateField, removeField } from './utils'
import type { DeepKeys } from '@tanstack/react-form'

export interface ModifierStore {
  current: FeatureModifierInput | null
  added: Map<string, FeatureModifierInput>
  edited: Map<string, FeatureModifierInput>
  removed: Set<string>
  setCurrent: (arg: FeatureModifierInput | null) => void
  upsertAdded: (arg: FeatureModifierInput) => void
  upsertEdited: (arg: FeatureModifierInput) => void
  remove: (id: string) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
}

export const useModifierStore = create<ModifierStore>()(
  persist(
    (set) => {
      return {
        current: null,
        added: new Map<string, FeatureModifierInput>(),
        edited: new Map<string, FeatureModifierInput>(),
        removed: new Set<string>(),
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        upsertAdded: (modifier) =>
          set((state) => {
            const newMap = new Map(state.added)
            newMap.set(modifier.id, modifier)
            return { added: newMap }
          }),
        upsertEdited: (modifier) =>
          set((state) => {
            const newMap = new Map(state.edited)
            newMap.set(modifier.id, modifier)
            return { edited: newMap }
          }),
        remove: (id: string) =>
          set((state) => {
            const newSet = new Set(state.removed)
            newSet.add(id)
            return { removed: newSet }
          }),
        updateField: ({ path, value }) =>
          set((state: ModifierStore) =>
            updateField<ModifierStore, FeatureModifierInput>({
              path,
              value,
              selector: (state) => state.current as FeatureModifierInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: ModifierStore) =>
            removeField<ModifierStore, FeatureModifierInput>({
              path,
              selector: (state) => state.current as FeatureModifierInput,
            })(state)
          ),
      }
    },
    {
      name: 'atapp-section-store',
    }
  )
)
