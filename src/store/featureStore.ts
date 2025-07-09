import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FeatureInput } from '@/types'
import { produce } from 'immer'
import type { DeepKeys } from '@tanstack/react-form'
import { updateField, removeField } from './utils'
import { SECTION_STEPS } from '@/components/Form'

export interface FeatureStore {
  current: FeatureInput | null
  step: (typeof SECTION_STEPS)[number] | 'options' | 'features' | null
  added: Map<string, FeatureInput>
  edited: Map<string, FeatureInput>
  removed: Set<string>
  setCurrent: (arg: FeatureInput | null) => void
  upsertAdded: (arg: FeatureInput) => void
  upsertEdited: (arg: FeatureInput) => void
  remove: (id: string) => void
  setStep: (arg: (typeof SECTION_STEPS)[number] | 'options' | 'features' | null) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
}

export const useFeatureStore = create<FeatureStore>()(
  persist(
    (set) => {
      return {
        current: null,
        step: null,
        added: new Map<string, FeatureInput>(),
        edited: new Map<string, FeatureInput>(),
        removed: new Set<string>(),
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        upsertAdded: (feature) =>
          set((state) => {
            const newMap = new Map(state.added)
            newMap.set(feature.id, feature)
            return { added: newMap }
          }),
        upsertEdited: (feature) =>
          set((state) => {
            const newMap = new Map(state.edited)
            newMap.set(feature.id, feature)
            return { edited: newMap }
          }),
        remove: (id: string) =>
          set((state) => {
            const newSet = new Set(state.removed)
            newSet.add(id)
            return { removed: newSet }
          }),
        setStep: (value) =>
          set((state) =>
            produce(state, (draft) => {
              draft.step = value
            })
          ),
        updateField: ({ path, value }) =>
          set((state: FeatureStore) =>
            updateField<FeatureStore, FeatureInput>({
              path,
              value,
              selector: (state) => state.current as FeatureInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: FeatureStore) =>
            removeField<FeatureStore, FeatureInput>({
              path,
              selector: (state) => state.current as FeatureInput,
            })(state)
          ),
      }
    },
    {
      name: 'atapp-Feature-store',
    }
  )
)
