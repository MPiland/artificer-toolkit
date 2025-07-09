import { create } from 'zustand'
import type { FeatureExpertiseInput } from '@/types'
import { persist } from 'zustand/middleware'
import { updateField, removeField } from './utils'
import type { DeepKeys } from '@tanstack/react-form'

export interface ExpertiseStore {
  current: FeatureExpertiseInput | null
  added: Map<string, FeatureExpertiseInput>
  edited: Map<string, FeatureExpertiseInput>
  removed: Set<string>
  setCurrent: (arg: FeatureExpertiseInput | null) => void
  upsertAdded: (arg: FeatureExpertiseInput) => void
  upsertEdited: (arg: FeatureExpertiseInput) => void
  remove: (id: string) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
}

export const useExpertiseStore = create<ExpertiseStore>()(
  persist(
    (set) => {
      return {
        current: null,
        added: new Map<string, FeatureExpertiseInput>(),
        edited: new Map<string, FeatureExpertiseInput>(),
        removed: new Set<string>(),
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        upsertAdded: (expertise) =>
          set((state) => {
            const newMap = new Map(state.added)
            newMap.set(expertise.id, expertise)
            return { added: newMap }
          }),
        upsertEdited: (expertise) =>
          set((state) => {
            const newMap = new Map(state.edited)
            newMap.set(expertise.id, expertise)
            return { edited: newMap }
          }),
        remove: (id: string) =>
          set((state) => {
            const newSet = new Set(state.removed)
            newSet.add(id)
            return { removed: newSet }
          }),
        updateField: ({ path, value }) =>
          set((state: ExpertiseStore) =>
            updateField<ExpertiseStore, FeatureExpertiseInput>({
              path,
              value,
              selector: (state) => state.current as FeatureExpertiseInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: ExpertiseStore) =>
            removeField<ExpertiseStore, FeatureExpertiseInput>({
              path,
              selector: (state) => state.current as FeatureExpertiseInput,
            })(state)
          ),
      }
    },
    {
      name: 'atapp-section-store',
    }
  )
)
