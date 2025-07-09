import { create } from 'zustand'
import type { AncestryOptionInput } from '@/types'
import { persist } from 'zustand/middleware'
import { updateField, removeField } from './utils'
import type { DeepKeys } from '@tanstack/react-form'

export interface AncestryStore {
  current: AncestryOptionInput | null
  added: Map<string, AncestryOptionInput>
  edited: Map<string, AncestryOptionInput>
  removed: Set<string>
  optionIndex: number
  step: 'ancestryOption' | null
  setStep: (arg: 'ancestryOption' | null) => void
  setOptionIndex: (arg: number) => void
  setCurrent: (arg: AncestryOptionInput | null) => void
  upsertAdded: (arg: AncestryOptionInput) => void
  upsertEdited: (arg: AncestryOptionInput) => void
  remove: (id: string) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
}

export const useAncestryStore = create<AncestryStore>()(
  persist(
    (set) => {
      return {
        current: null,
        added: new Map<string, AncestryOptionInput>(),
        edited: new Map<string, AncestryOptionInput>(),
        removed: new Set<string>(),
        step: null,
        setStep: (value) => set((state) => ({ ...state, step: value })),
        optionIndex: 0,
        setOptionIndex: (value) => set((state) => ({ ...state, optionIndex: value })),
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
        updateField: ({ path, value }) =>
          set((state: AncestryStore) =>
            updateField<AncestryStore, AncestryOptionInput>({
              path,
              value,
              selector: (state) => state.current as AncestryOptionInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: AncestryStore) =>
            removeField<AncestryStore, AncestryOptionInput>({
              path,
              selector: (state) => state.current as AncestryOptionInput,
            })(state)
          ),
      }
    },
    {
      name: 'atapp-ancestry-store',
    }
  )
)
