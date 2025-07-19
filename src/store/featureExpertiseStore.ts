import { create } from 'zustand'
import type { FeatureExpertiseInput } from '@/types'
import { persist, type StorageValue } from 'zustand/middleware'
import { updateField, removeField } from './utils'
import type { DeepKeys } from '@tanstack/react-form'

export interface FeatureExpertiseStore {
  current: FeatureExpertiseInput | null
  added: Map<string, FeatureExpertiseInput>
  edited: Map<string, FeatureExpertiseInput>
  valid: Map<string, boolean>
  removed: Set<string>
  formReset: (() => void) | null
  registerFormReset: (reset: () => void) => void
  setCurrent: (arg: FeatureExpertiseInput | null) => void
  upsertAdded: (arg: FeatureExpertiseInput) => void
  upsertEdited: (arg: FeatureExpertiseInput) => void
  upsertValid: (arg: string, isValid: boolean) => void
  remove: (id: string) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
  reset: () => void
}

export const useFeatureExpertiseStore = create<FeatureExpertiseStore>()(
  persist(
    (set) => {
      return {
        current: null,
        added: new Map<string, FeatureExpertiseInput>(),
        edited: new Map<string, FeatureExpertiseInput>(),
        valid: new Map<string, boolean>(),
        removed: new Set<string>(),
        formReset: null,
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        registerFormReset: (value) => set((state) => ({ ...state, formReset: value })),
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
        upsertValid: (id: string, isValid: boolean) =>
          set((state) => {
            const newMap = new Map(state.valid)
            newMap.set(id, isValid)
            return { valid: newMap }
          }),
        remove: (id: string) =>
          set((state) => {
            const newSet = new Set(state.removed)
            newSet.add(id)
            return { removed: newSet }
          }),
        updateField: ({ path, value }) =>
          set((state: FeatureExpertiseStore) =>
            updateField<FeatureExpertiseStore, FeatureExpertiseInput>({
              path,
              value,
              selector: (state) => state.current as FeatureExpertiseInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: FeatureExpertiseStore) =>
            removeField<FeatureExpertiseStore, FeatureExpertiseInput>({
              path,
              selector: (state) => state.current as FeatureExpertiseInput,
            })(state)
          ),
        reset: () =>
          set((state) => ({
            ...state,
            current: null,
            step: null,
            added: new Map(),
            edited: new Map(),
            valid: new Map(),
            removed: new Set(),
            formReset: () => undefined,
          })),
      }
    },
    {
      name: 'atapp-feature-expertise-store',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const existingValue = JSON.parse(str)
          return {
            ...existingValue,
            state: {
              ...existingValue.state,
              added: new Map(existingValue.state.added),
              edited: new Map(existingValue.state.edited),
              valid: new Map(existingValue.state.valid),
              removed: new Set(existingValue.state.removed),
            },
          }
        },
        setItem: (name, newValue: StorageValue<FeatureExpertiseStore>) => {
          const str = JSON.stringify({
            ...newValue,
            state: {
              ...newValue.state,
              added: Array.from(newValue.state.added.entries()),
              edited: Array.from(newValue.state.edited.entries()),
              valid: Array.from(newValue.state.valid.entries()),
              removed: Array.from(newValue.state.removed.values()),
            },
          })
          localStorage.setItem(name, str)
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
)
