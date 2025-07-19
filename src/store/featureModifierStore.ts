import { create } from 'zustand'
import type { FeatureModifierInput } from '@/types'
import { persist, type StorageValue } from 'zustand/middleware'
import { updateField, removeField } from './utils'
import type { DeepKeys } from '@tanstack/react-form'

export interface FeatureModifierStore {
  current: FeatureModifierInput | null
  added: Map<string, FeatureModifierInput>
  edited: Map<string, FeatureModifierInput>
  valid: Map<string, boolean>
  removed: Set<string>
  formReset: (() => void) | null
  registerFormReset: (reset: () => void) => void
  setCurrent: (arg: FeatureModifierInput | null) => void
  upsertAdded: (arg: FeatureModifierInput) => void
  upsertEdited: (arg: FeatureModifierInput) => void
  upsertValid: (arg: string, isValid: boolean) => void
  remove: (id: string) => void
  updateField<T>(arg: { path: DeepKeys<T>; value: unknown }): void
  removeField<T>(arg: { path: DeepKeys<T> }): void
  reset: () => void
}

export const useFeatureModifierStore = create<FeatureModifierStore>()(
  persist(
    (set) => {
      return {
        current: null,
        added: new Map<string, FeatureModifierInput>(),
        edited: new Map<string, FeatureModifierInput>(),
        valid: new Map<string, boolean>(),
        removed: new Set<string>(),
        formReset: null,
        setCurrent: (value) => set((state) => ({ ...state, current: value })),
        registerFormReset: (value) => set((state) => ({ ...state, formReset: value })),
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
          set((state: FeatureModifierStore) =>
            updateField<FeatureModifierStore, FeatureModifierInput>({
              path,
              value,
              selector: (state) => state.current as FeatureModifierInput,
            })(state)
          ),
        removeField: ({ path }) =>
          set((state: FeatureModifierStore) =>
            removeField<FeatureModifierStore, FeatureModifierInput>({
              path,
              selector: (state) => state.current as FeatureModifierInput,
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
      name: 'atapp-feature-modifier-store',
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
        setItem: (name, newValue: StorageValue<FeatureModifierStore>) => {
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
