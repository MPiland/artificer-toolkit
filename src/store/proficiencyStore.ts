import { create } from 'zustand'
import type { FeatureProficiencyInput } from '@/types'
import { persist } from 'zustand/middleware'
import { updateField, removeField } from './utils'
import type { DeepKeys } from '@tanstack/react-form'

export interface ProficiencyStore {
  current: FeatureProficiencyInput | null
  added: Map<string, FeatureProficiencyInput>
  edited: Map<string, FeatureProficiencyInput>
  removed: Set<string>
  setCurrent: (arg: FeatureProficiencyInput | null) => void
  upsertAdded: (arg: FeatureProficiencyInput) => void
  upsertEdited: (arg: FeatureProficiencyInput) => void
  remove: (id: string) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
}

export const useProficiencyStore = create<ProficiencyStore>()(
  persist(
    (set) => {
      return {
        current: null,
        added: new Map<string, FeatureProficiencyInput>(),
        edited: new Map<string, FeatureProficiencyInput>(),
        removed: new Set<string>(),
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        upsertAdded: (proficiency) =>
          set((state) => {
            const newMap = new Map(state.added)
            newMap.set(proficiency.id, proficiency)
            return { added: newMap }
          }),
        upsertEdited: (proficiency) =>
          set((state) => {
            const newMap = new Map(state.edited)
            newMap.set(proficiency.id, proficiency)
            return { edited: newMap }
          }),
        remove: (id: string) =>
          set((state) => {
            const newSet = new Set(state.removed)
            newSet.add(id)
            return { removed: newSet }
          }),
        updateField: ({ path, value }) =>
          set((state: ProficiencyStore) =>
            updateField<ProficiencyStore, FeatureProficiencyInput>({
              path,
              value,
              selector: (state) => state.current as FeatureProficiencyInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: ProficiencyStore) =>
            removeField<ProficiencyStore, FeatureProficiencyInput>({
              path,
              selector: (state) => state.current as FeatureProficiencyInput,
            })(state)
          ),
      }
    },
    {
      name: 'atapp-section-store',
    }
  )
)
