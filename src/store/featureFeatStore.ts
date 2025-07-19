import { create } from 'zustand'
import type { FeatureFeatInput } from '@/types'
import { persist, type StorageValue } from 'zustand/middleware'
import { updateField, removeField } from './utils'
import type { DeepKeys } from '@tanstack/react-form'

export interface FeatureFeatStore {
  current: FeatureFeatInput | null
  added: Map<string, FeatureFeatInput>
  edited: Map<string, FeatureFeatInput>
  valid: Map<string, boolean>
  removed: Set<string>
  formReset: (() => void) | null
  registerFormReset: (reset: () => void) => void
  setCurrent: (arg: FeatureFeatInput | null) => void
  upsertAdded: (arg: FeatureFeatInput) => void
  upsertEdited: (arg: FeatureFeatInput) => void
  upsertValid: (arg: string, isValid: boolean) => void
  remove: (id: string) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
  reset: () => void
}

export const useFeatureFeatStore = create<FeatureFeatStore>()(
  persist(
    (set) => {
      return {
        current: null,
        added: new Map<string, FeatureFeatInput>(),
        edited: new Map<string, FeatureFeatInput>(),
        valid: new Map<string, boolean>(),
        removed: new Set<string>(),
        formReset: null,
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        registerFormReset: (value) => set((state) => ({ ...state, formReset: value })),
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
          set((state: FeatureFeatStore) =>
            updateField<FeatureFeatStore, FeatureFeatInput>({
              path,
              value,
              selector: (state) => state.current as FeatureFeatInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: FeatureFeatStore) =>
            removeField<FeatureFeatStore, FeatureFeatInput>({
              path,
              selector: (state) => state.current as FeatureFeatInput,
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
      name: 'atapp-feature-feat-store',
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
        setItem: (name, newValue: StorageValue<FeatureFeatStore>) => {
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
