import { create } from 'zustand'
import type { FeatureSpellInput } from '@/types'
import { persist } from 'zustand/middleware'
import { updateField, removeField } from './utils'
import type { DeepKeys } from '@tanstack/react-form'

export interface SpellStore {
  current: FeatureSpellInput | null
  added: Map<string, FeatureSpellInput>
  edited: Map<string, FeatureSpellInput>
  removed: Set<string>
  setCurrent: (arg: FeatureSpellInput | null) => void
  upsertAdded: (arg: FeatureSpellInput) => void
  upsertEdited: (arg: FeatureSpellInput) => void
  remove: (id: string) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
}

export const useSpellStore = create<SpellStore>()(
  persist(
    (set) => {
      return {
        current: null,
        added: new Map<string, FeatureSpellInput>(),
        edited: new Map<string, FeatureSpellInput>(),
        removed: new Set<string>(),
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        upsertAdded: (spell) =>
          set((state) => {
            const newMap = new Map(state.added)
            newMap.set(spell.id, spell)
            return { added: newMap }
          }),
        upsertEdited: (spell) =>
          set((state) => {
            const newMap = new Map(state.edited)
            newMap.set(spell.id, spell)
            return { edited: newMap }
          }),
        remove: (id: string) =>
          set((state) => {
            const newSet = new Set(state.removed)
            newSet.add(id)
            return { removed: newSet }
          }),
        updateField: ({ path, value }) =>
          set((state: SpellStore) =>
            updateField<SpellStore, FeatureSpellInput>({
              path,
              value,
              selector: (state) => state.current as FeatureSpellInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: SpellStore) =>
            removeField<SpellStore, FeatureSpellInput>({
              path,
              selector: (state) => state.current as FeatureSpellInput,
            })(state)
          ),
      }
    },
    {
      name: 'atapp-section-store',
    }
  )
)
